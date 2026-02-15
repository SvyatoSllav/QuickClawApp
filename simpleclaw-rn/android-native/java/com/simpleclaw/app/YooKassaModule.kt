package com.simpleclaw.app

import android.app.Activity
import android.content.Intent
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import ru.yoomoney.sdk.kassa.payments.Checkout
import ru.yoomoney.sdk.kassa.payments.checkoutParameters.Amount
import ru.yoomoney.sdk.kassa.payments.checkoutParameters.PaymentMethodType
import ru.yoomoney.sdk.kassa.payments.checkoutParameters.PaymentParameters
import ru.yoomoney.sdk.kassa.payments.checkoutParameters.SavePaymentMethod
import java.math.BigDecimal
import java.util.Currency

class YooKassaModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), ActivityEventListener {

    private var paymentPromise: Promise? = null

    companion object {
        private const val REQUEST_CODE_TOKENIZE = 1001
    }

    init {
        reactContext.addActivityEventListener(this)
    }

    override fun getName(): String = "YooKassaModule"

    @ReactMethod
    fun startTokenization(
        shopId: String,
        clientKey: String,
        amount: String,
        title: String,
        description: String,
        promise: Promise
    ) {
        val activity = reactContext.currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "No current activity")
            return
        }

        paymentPromise = promise

        val paymentParameters = PaymentParameters(
            amount = Amount(BigDecimal(amount), Currency.getInstance("RUB")),
            title = title,
            subtitle = description,
            clientApplicationKey = clientKey,
            shopId = shopId,
            savePaymentMethod = SavePaymentMethod.ON,
            paymentMethodTypes = setOf(
                PaymentMethodType.BANK_CARD,
                PaymentMethodType.YOO_MONEY,
            ),
        )

        val intent = Checkout.createTokenizeIntent(reactContext, paymentParameters)
        activity.startActivityForResult(intent, REQUEST_CODE_TOKENIZE)
    }

    override fun onActivityResult(
        activity: Activity,
        requestCode: Int,
        resultCode: Int,
        data: Intent?
    ) {
        if (requestCode != REQUEST_CODE_TOKENIZE) return

        val promise = paymentPromise ?: return
        paymentPromise = null

        if (resultCode == Activity.RESULT_OK && data != null) {
            val result = Checkout.createTokenizationResult(data)
            promise.resolve(result.paymentToken)
        } else {
            promise.reject("CANCELLED", "Payment was cancelled by user")
        }
    }

    override fun onNewIntent(intent: Intent) {}
}
