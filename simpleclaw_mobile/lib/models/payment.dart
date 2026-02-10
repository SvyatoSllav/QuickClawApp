class PaymentResponse {
  const PaymentResponse({
    required this.paymentId,
    required this.confirmationUrl,
    required this.yookassaId,
  });

  final int paymentId;
  final String confirmationUrl;
  final String yookassaId;

  factory PaymentResponse.fromJson(Map<String, dynamic> json) {
    return PaymentResponse(
      paymentId: json['payment_id'] as int,
      confirmationUrl: json['confirmation_url'] as String,
      yookassaId: json['yookassa_id'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'payment_id': paymentId,
      'confirmation_url': confirmationUrl,
      'yookassa_id': yookassaId,
    };
  }
}
