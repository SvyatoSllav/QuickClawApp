class UsageData {
  const UsageData({
    required this.used,
    required this.limit,
    required this.remaining,
  });

  final double used;
  final double limit;
  final double remaining;

  factory UsageData.fromJson(Map<String, dynamic> json) {
    return UsageData(
      used: (json['used'] as num).toDouble(),
      limit: (json['limit'] as num).toDouble(),
      remaining: (json['remaining'] as num).toDouble(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'used': used,
      'limit': limit,
      'remaining': remaining,
    };
  }
}
