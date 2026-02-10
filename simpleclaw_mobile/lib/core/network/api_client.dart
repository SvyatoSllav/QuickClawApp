import 'package:dio/dio.dart';

import 'package:simpleclaw_mobile/config/app_config.dart';
import 'package:simpleclaw_mobile/core/network/api_exceptions.dart';
import 'package:simpleclaw_mobile/core/storage/secure_storage.dart';

class ApiClient {
  final Dio _dio;
  final SecureStorageService _storage;

  ApiClient(this._storage)
      : _dio = Dio(
          BaseOptions(
            baseUrl: AppConfig.apiBaseUrl,
            connectTimeout: const Duration(seconds: 15),
            receiveTimeout: const Duration(seconds: 30),
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
          ),
        ) {
    _dio.interceptors.add(_buildAuthInterceptor());
    _dio.interceptors.add(_buildErrorInterceptor());
  }

  Interceptor _buildAuthInterceptor() {
    return InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _storage.getAuthToken();
        if (token != null && token.isNotEmpty) {
          options.headers['Authorization'] = 'Token $token';
        }
        handler.next(options);
      },
    );
  }

  Interceptor _buildErrorInterceptor() {
    return InterceptorsWrapper(
      onError: (error, handler) {
        if (error.type == DioExceptionType.connectionTimeout ||
            error.type == DioExceptionType.receiveTimeout ||
            error.type == DioExceptionType.sendTimeout ||
            error.type == DioExceptionType.connectionError) {
          handler.reject(
            DioException(
              requestOptions: error.requestOptions,
              error: const NetworkException('Connection error'),
              type: error.type,
            ),
          );
          return;
        }

        final statusCode = error.response?.statusCode;

        if (statusCode == 401) {
          handler.reject(
            DioException(
              requestOptions: error.requestOptions,
              error: const UnauthorizedException(),
              type: error.type,
              response: error.response,
            ),
          );
          return;
        }

        final responseData = error.response?.data;
        String message = 'An error occurred';

        if (responseData is Map<String, dynamic>) {
          message = responseData['error'] as String? ??
              responseData['detail'] as String? ??
              message;
        }

        handler.reject(
          DioException(
            requestOptions: error.requestOptions,
            error: ApiException(message, statusCode: statusCode),
            type: error.type,
            response: error.response,
          ),
        );
      },
    );
  }

  Future<Response<dynamic>> get(String path) {
    return _dio.get(path);
  }

  Future<Response<dynamic>> post(
    String path, {
    Object? data,
  }) {
    return _dio.post(path, data: data);
  }

  Future<Response<dynamic>> patch(
    String path, {
    Object? data,
  }) {
    return _dio.patch(path, data: data);
  }

  Future<Response<dynamic>> delete(String path) {
    return _dio.delete(path);
  }
}
