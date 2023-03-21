odoo.define("pos_mpesa.MpesaExpress", function (require) {
  "use strict";

  var core = require("web.core");
  var _t = core._t;
  var PaymentInterface = require("point_of_sale.PaymentInterface");
  var models = require("point_of_sale.models");
  const { Gui } = require("point_of_sale.Gui");
  var rpc = require("web.rpc");

  /**
   * Implement this interface to support a new payment method in the POS:
   *
   * var PaymentInterface = require('point_of_sale.PaymentInterface');
   * var MyPayment = PaymentInterface.extend({
   *     ...
   * })
   *
   * To connect the interface to the right payment methods register it:
   *
   * var models = require('point_of_sale.models');
   * models.register_payment_method('my_payment', MyPayment);
   *
   * my_payment is the technical name of the added selection in
   * use_payment_terminal.
   *
   * If necessary new fields can be loaded on any model:
   *
   * models.load_fields('pos.payment.method', ['new_field1', 'new_field2']);
   */
  var MpesaExpress = PaymentInterface.extend({
    init: function (pos, payment_method) {
      this.pos = pos;
      this.payment_method = payment_method;
      this.supports_reversals = false;
    },

    /**
     * Call this function to enable UI elements that allow a user to
     * reverse a payment. This requires that you implement
     * send_payment_reversal.
     */
    enable_reversals: function () {
      this.supports_reversals = true;
    },

    /**
     * Called when a user clicks the "Send" button in the
     * interface. This should initiate a payment request and return a
     * Promise that resolves when the final status of the payment line
     * is set with set_payment_status.
     *
     * For successful transactions set_receipt_info() should be used
     * to set info that should to be printed on the receipt. You
     * should also set card_type and transaction_id on the line for
     * successful transactions.
     *
     * @param {string} cid - The id of the paymentline
     * @returns {Promise} resolved with a boolean that is false when
     * the payment should be retried. Rejected when the status of the
     * paymentline will be manually updated.
     */
    send_payment_request: async function (cid) {
      var self = this;
      var payload = await self.showPaymentRequestPrompt();
      if (!payload.phoneNumber) {
        return false;
      }
      if (!/254\d{9}/.test(payload.phoneNumber)) {
        await self.showError(
          _t("Invalid number! Expected format: 254XXXXXXXX")
        );
        return false;
      }
      self.customerPhoneNumber = payload.phoneNumber;
      var order = this.pos.get_order();
      self.selectedPaymentLine = order.selected_paymentline;
      var amount = order.selected_paymentline.amount;
      if (amount <= 0) {
        await self.showError(
          _t("Cannot process payment - Invalid amount: " + amount)
        );
        return false;
      }
      return rpc
        .query(
          {
            model: "pos_mpesa.payment",
            method: "stk_push",
            args: [
              {
                PaymentMethod: this.payment_method.id,
                PhoneNumber: payload.phoneNumber,
                Description: payload.description,
                Amount: amount,
              },
            ],
          },
          {
            timeout: 60000,
            shadow: true,
          }
        )
        .then(function (result) {
          console.log("stk_push result", result);
          self.stkPushResult = result;
          return self.startPaymentPolling(result);
        })
        .catch(function (err) {
          console.error("stk_push error", err);
          return false;
        });
    },

    /**
     * Called when a user removes a payment line that's still waiting
     * on send_payment_request to complete. Should execute some
     * request to ensure the current payment request is
     * cancelled. This is not to refund payments, only to cancel
     * them. The payment line being cancelled will be deleted
     * automatically after the returned promise resolves.
     *
     * @param {} order - The order of the paymentline
     * @param {string} cid - The id of the paymentline
     * @returns {Promise}
     */
    send_payment_cancel: async function (order, cid) {
      this.reset();
    },

    /**
     * This is an optional method. When implementing this make sure to
     * call enable_reversals() in the constructor of your
     * interface. This should reverse a previous payment with status
     * 'done'. The paymentline will be removed based on returned
     * Promise.
     *
     * @param {string} cid - The id of the paymentline
     * @returns {Promise} returns true if the reversal was successful.
     */
    send_payment_reversal: function (cid) {},

    /**
     * Called when the payment screen in the POS is closed (by
     * e.g. clicking the "Back" button). Could be used to cancel in
     * progress payments.
     */
    close: function () {
      this.reset();
    },

    showPaymentRequestPrompt: async function () {
      var result = await Gui.showPopup("PaymentRequestPopup", {
        title: _t("Payment Request Info?"),
        phoneNumberPrefix: "254",
      });
      return result.confirmed ? result.payload : false;
    },

    showError: async function (message) {
      return Gui.showPopup("ErrorPopup", { body: message });
    },

    showSuccess: async function (message) {
      return Gui.showPopup("SuccessPopup", { body: message });
    },

    startPaymentPolling: async function (requestInfo) {
      var self = this;
      return new Promise(function (resolve, reject) {
        var interval = 5000;
        var checkInProgress = false;
        var retries = 10;
        self.pollId = setInterval(function () {
          if (checkInProgress) {
            return;
          }
          rpc
            .query(
              {
                model: "pos_mpesa.payment",
                method: "check_payment",
                args: [requestInfo],
              },
              {
                timeout: interval,
                shadow: true,
              }
            )
            .then(async function (result) {
              console.log("check_payment result", result);
              if (result.status === "SUCCESS") {
                await self.showSuccess(
                  result.message +
                    "\nTransaction ID: " +
                    result.mpesa_receipt_number
                );
                self.selectedPaymentLine.set_payment_status("done");
                self.selectedPaymentLine.set_receipt_info(
                  "Transaction ID: " + result.mpesa_receipt_number
                );
                resolve(true);
              }
              if (result.status === "FAILED") {
                await self.showError(result.message);
                self.selectedPaymentLine.set_payment_status("retry");
                resolve(false);
              }
            })
            .catch(function (err) {
              console.error("check_payment error", err);
              if (retries === 0) {
                reject(err);
              }
              retries--;
            })
            .finally(function () {
              checkInProgress = false;
            });
          checkInProgress = true;
        }, interval);
      }).finally(function () {
        self.reset(); // Stop polling
      });
    },

    reset: async function () {
      clearTimeout(this.pollId);
    },
  });

  models.register_payment_method("mpesa_express", MpesaExpress);

  return MpesaExpress;
});
