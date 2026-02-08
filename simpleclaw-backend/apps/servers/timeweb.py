"""TimeWeb Cloud API integration for server provisioning"""
import logging
import time
import requests
from django.conf import settings

logger = logging.getLogger(__name__)

TIMEWEB_API_BASE = 'https://api.timeweb.cloud/api/v1'
# Preset: 2 CPU 3.3GHz, 4GB RAM, 50GB NVMe, Moscow, 1000 RUB/month
PRESET_ID = 4801


def get_headers():
    return {
        'Authorization': f'Bearer {settings.TIMEWEB_API_TOKEN}',
        'Content-Type': 'application/json',
    }


def get_ubuntu_os_id():
    """Get Ubuntu 22.04 OS ID"""
    try:
        resp = requests.get(
            f'{TIMEWEB_API_BASE}/os/servers',
            headers=get_headers(),
            timeout=30,
        )
        if resp.status_code == 200:
            os_images = resp.json().get('servers_os', [])
            for os_img in os_images:
                name = os_img.get('name', '').lower()
                version = os_img.get('version', '')
                if 'ubuntu' in name and '22' in version:
                    return os_img.get('id')
            # Fallback to any Ubuntu
            for os_img in os_images:
                if 'ubuntu' in os_img.get('name', '').lower():
                    return os_img.get('id')
        return None
    except Exception as e:
        logger.error(f'Failed to get OS images: {e}')
        return None


def create_server(name, user_email):
    """Create a new server via TimeWeb API"""
    token = getattr(settings, 'TIMEWEB_API_TOKEN', '')
    if not token:
        logger.error('TIMEWEB_API_TOKEN not configured')
        return None

    os_id = get_ubuntu_os_id()
    if not os_id:
        logger.error('Could not find Ubuntu OS image')
        return None

    server_data = {
        'name': name,
        'comment': 'SimpleClaw pool server',
        'preset_id': PRESET_ID,
        'os_id': os_id,
        'bandwidth': 1000,
        'is_ddos_guard': False,
        'is_local_network': False,
    }

    try:
        logger.info(f'Creating TimeWeb server: {server_data}')
        resp = requests.post(
            f'{TIMEWEB_API_BASE}/servers',
            headers=get_headers(),
            json=server_data,
            timeout=60,
        )

        if resp.status_code in (200, 201):
            data = resp.json()
            server = data.get('server', {})
            logger.info(f'TimeWeb server created: ID={server.get("id")}, status={server.get("status")}')
            return {
                'id': server.get('id'),
                'status': server.get('status'),
                'root_pass': server.get('root_pass', ''),
            }
        else:
            logger.error(f'TimeWeb create error: {resp.status_code} {resp.text}')
            return None
    except Exception as e:
        logger.error(f'TimeWeb create exception: {e}')
        return None


def get_server_info(server_id):
    """Get server details"""
    try:
        resp = requests.get(
            f'{TIMEWEB_API_BASE}/servers/{server_id}',
            headers=get_headers(),
            timeout=30,
        )
        if resp.status_code == 200:
            return resp.json().get('server', {})
        return None
    except Exception as e:
        logger.error(f'TimeWeb get server error: {e}')
        return None


def add_ipv4_to_server(server_id, max_retries=5):
    """Add IPv4 address to a server that only has IPv6, with retry and wait"""
    for attempt in range(max_retries):
        try:
            logger.info(f'Adding IPv4 to server {server_id} (attempt {attempt + 1}/{max_retries})')
            resp = requests.post(
                f'{TIMEWEB_API_BASE}/servers/{server_id}/ips',
                headers=get_headers(),
                json={'type': 'ipv4'},
                timeout=30,
            )

            if resp.status_code in (200, 201):
                data = resp.json()
                ip_info = data.get('server_ip', {})
                ip = ip_info.get('ip')
                if ip:
                    logger.info(f'Added IPv4 {ip} to server {server_id}')
                    return ip

            # Wait and check server info for IPv4
            logger.info(f'IPv4 not ready yet, waiting 20s...')
            time.sleep(20)

            # Check if IPv4 appeared in server info
            info = get_server_info(server_id)
            if info:
                networks = info.get('networks', [])
                for net in networks:
                    for ip_data in net.get('ips', []):
                        if ip_data.get('type') == 'ipv4':
                            ip = ip_data.get('ip')
                            logger.info(f'Found IPv4 {ip} in server info')
                            return ip

        except Exception as e:
            logger.error(f'Exception adding IPv4 (attempt {attempt + 1}): {e}')
            time.sleep(10)

    logger.error(f'Failed to add IPv4 to server {server_id} after {max_retries} attempts')
    return None


def wait_for_server_ready(server_id, max_wait=300):
    """Wait for server to be ready and return IPv4 (adds IPv4 if only IPv6)"""
    start = time.time()
    root_pass = None

    while time.time() - start < max_wait:
        info = get_server_info(server_id)
        if info:
            status = info.get('status')
            if not root_pass:
                root_pass = info.get('root_pass', '')

            logger.info(f'Server {server_id} status: {status}')

            if status == 'on':
                networks = info.get('networks', [])
                ipv4 = None
                ipv6 = None
                for net in networks:
                    ips = net.get('ips', [])
                    for ip_info in ips:
                        ip = ip_info.get('ip')
                        ip_type = ip_info.get('type')
                        if ip_type == 'ipv4':
                            ipv4 = ip
                        elif ip_type == 'ipv6':
                            ipv6 = ip

                # If only IPv6, try to add IPv4 with retries
                if not ipv4 and ipv6:
                    logger.info(f'Server {server_id} only has IPv6 ({ipv6}), adding IPv4...')
                    ipv4 = add_ipv4_to_server(server_id, max_retries=5)
                    if ipv4:
                        logger.info(f'Successfully added IPv4 {ipv4} to server {server_id}')

                if ipv4:
                    logger.info(f'Server ready: IP={ipv4}')
                    return {
                        'ip': ipv4,
                        'root_pass': root_pass,
                        'status': 'ready',
                    }
                else:
                    # NO IPv4 - return None to trigger retry
                    logger.error(f'Server {server_id} has no IPv4, returning None to retry')
                    return None

        time.sleep(15)

    logger.error(f'Server {server_id} timeout after {max_wait}s')
    return None


def delete_server(server_id):
    """Delete a server"""
    try:
        resp = requests.delete(
            f'{TIMEWEB_API_BASE}/servers/{server_id}',
            headers=get_headers(),
            json={'hash': server_id},
            timeout=30,
        )
        logger.info(f'Delete server {server_id}: {resp.status_code}')
        return resp.status_code in (200, 204)
    except Exception as e:
        logger.error(f'TimeWeb delete error: {e}')
        return False
