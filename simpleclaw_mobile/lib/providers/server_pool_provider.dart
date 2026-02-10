import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:simpleclaw_mobile/models/server_pool.dart';
import 'package:simpleclaw_mobile/providers/auth_provider.dart';

final serverPoolProvider = FutureProvider<ServerPool>((ref) async {
  final serverService = ref.read(serverServiceProvider);
  return serverService.getPool();
});
