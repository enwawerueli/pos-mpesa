odoo.define('pos_mpesa.CancelPaymentPopup', function(require) {
    'use strict';

    const AbstractAwaitablePopup = require('point_of_sale.AbstractAwaitablePopup');
    const Registries = require('point_of_sale.Registries');
    const { _lt } = require('@web/core/l10n/translation');

    class CancelPaymentPopup extends AbstractAwaitablePopup {
        retryPayment() {
            console.log("retry")
        }

        checkPayment() {
            console.log("check payment:")
        }
    }
    CancelPaymentPopup.defaultProps = {
        title: "Cancel Payment",
        confirmText: "Confirm"
    }
    CancelPaymentPopup.template = 'CancelPaymentPopup';

    Registries.Component.add(CancelPaymentPopup);

    return CancelPaymentPopup;
});
