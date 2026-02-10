class ServerPool {
  const ServerPool({
    required this.available,
    required this.totalActive,
    required this.total,
  });

  final int available;
  final int totalActive;
  final int total;

  factory ServerPool.fromJson(Map<String, dynamic> json) {
    return ServerPool(
      available: json['available'] as int,
      totalActive: json['total_active'] as int,
      total: json['total'] as int,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'available': available,
      'total_active': totalActive,
      'total': total,
    };
  }
}
