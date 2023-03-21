odoo.define('pos_mpesa.SuccessPopup', function(require) {
    'use strict';

    const AbstractAwaitablePopup = require('point_of_sale.AbstractAwaitablePopup');
    const Registries = require('point_of_sale.Registries');
    const { _lt } = require('@web/core/l10n/translation');

    class SuccessPopup extends AbstractAwaitablePopup {}
    SuccessPopup.template = 'SuccessPopup';
    SuccessPopup.defaultProps = {
        confirmText: _lt('Ok'),
        title: _lt('Success'),
        body: '',
    };

    Registries.Component.add(SuccessPopup);

    return SuccessPopup;
});
