class SubscriptionData {
  const SubscriptionData({
    required this.isActive,
    required this.autoRenew,
    required this.status,
    this.currentPeriodStart,
    this.currentPeriodEnd,
    this.cancelledAt,
    required this.hasPaymentMethod,
    this.serverIp,
  });

  final bool isActive;
  final bool autoRenew;
  final String status;
  final DateTime? currentPeriodStart;
  final DateTime? currentPeriodEnd;
  final DateTime? cancelledAt;
  final bool hasPaymentMethod;
  final String? serverIp;

  factory SubscriptionData.fromJson(Map<String, dynamic> json) {
    return SubscriptionData(
      isActive: json['is_active'] as bool,
      autoRenew: json['auto_renew'] as bool,
      status: json['status'] as String,
      currentPeriodStart: json['current_period_start'] != null
          ? DateTime.parse(json['current_period_start'] as String)
          : null,
      currentPeriodEnd: json['current_period_end'] != null
          ? DateTime.parse(json['current_period_end'] as String)
          : null,
      cancelledAt: json['cancelled_at'] != null
          ? DateTime.parse(json['cancelled_at'] as String)
          : null,
      hasPaymentMethod: json['has_payment_method'] as bool,
      serverIp: json['server_ip'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'is_active': isActive,
      'auto_renew': autoRenew,
      'status': status,
      'current_period_start': currentPeriodStart?.toIso8601String(),
      'current_period_end': currentPeriodEnd?.toIso8601String(),
      'cancelled_at': cancelledAt?.toIso8601String(),
      'has_payment_method': hasPaymentMethod,
      'server_ip': serverIp,
    };
  }
}
