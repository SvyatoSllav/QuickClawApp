import { Platform, NativeModules } from 'react-native';

const { YooKassaModule } = NativeModules;

export async function startYooKassaCheckout(params: {
  shopId: string;
  clientKey: string;
  amount: string;
  title: string;
  description: string;
}): Promise<string> {
  if (Platform.OS !== 'android') {
    throw new Error('YooKassa SDK is only available on Android');
  }
  if (!YooKassaModule) {
    throw new Error('YooKassaModule native module is not linked');
  }
  return YooKassaModule.startTokenization(
    params.shopId,
    params.clientKey,
    params.amount,
    params.title,
    params.description,
  );
}
