import 'profile.dart';

class UserData {
  const UserData({
    required this.id,
    required this.email,
    required this.firstName,
    required this.lastName,
    this.profile,
  });

  final int id;
  final String email;
  final String firstName;
  final String lastName;
  final ProfileData? profile;

  factory UserData.fromJson(Map<String, dynamic> json) {
    return UserData(
      id: json['id'] as int,
      email: json['email'] as String,
      firstName: json['first_name'] as String,
      lastName: json['last_name'] as String,
      profile: json['profile'] != null
          ? ProfileData.fromJson(json['profile'] as Map<String, dynamic>)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'first_name': firstName,
      'last_name': lastName,
      'profile': profile?.toJson(),
    };
  }
}
