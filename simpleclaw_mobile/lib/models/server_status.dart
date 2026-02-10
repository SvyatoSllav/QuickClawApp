class ServerStatus {
  const ServerStatus({
    required this.assigned,
    this.ipAddress,
    this.status,
    required this.openclawRunning,
    this.lastHealthCheck,
  });

  final bool assigned;
  final String? ipAddress;
  final String? status;
  final bool openclawRunning;
  final DateTime? lastHealthCheck;

  factory ServerStatus.fromJson(Map<String, dynamic> json) {
    return ServerStatus(
      assigned: json['assigned'] as bool,
      ipAddress: json['ip_address'] as String?,
      status: json['status'] as String?,
      openclawRunning: json['openclaw_running'] as bool,
      lastHealthCheck: json['last_health_check'] != null
          ? DateTime.parse(json['last_health_check'] as String)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'assigned': assigned,
      'ip_address': ipAddress,
      'status': status,
      'openclaw_running': openclawRunning,
      'last_health_check': lastHealthCheck?.toIso8601String(),
    };
  }
}
