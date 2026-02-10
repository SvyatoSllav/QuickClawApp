import 'user.dart';

class AuthResponse {
  const AuthResponse({
    required this.token,
    required this.user,
    required this.created,
  });

  final String token;
  final UserData user;
  final bool created;

  factory AuthResponse.fromJson(Map<String, dynamic> json) {
    return AuthResponse(
      token: json['token'] as String,
      user: UserData.fromJson(json['user'] as Map<String, dynamic>),
      created: json['created'] as bool,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'token': token,
      'user': user.toJson(),
      'created': created,
    };
  }
}
