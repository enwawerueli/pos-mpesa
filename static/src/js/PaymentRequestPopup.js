odoo.define("point_of_sale.PaymentRequestPopup", function (require) {
  "use strict";

  const { useState, useRef } = owl.hooks;
  const AbstractAwaitablePopup = require("point_of_sale.AbstractAwaitablePopup");
  const Registries = require("point_of_sale.Registries");
  const { _lt } = require("@web/core/l10n/translation");

  class PaymentRequestPopup extends AbstractAwaitablePopup {
    constructor() {
      super(...arguments);
      this.state = useState({
        phoneNumber: this.props.phoneNumberPrefix,
        description: "",
      });
      this.phoneNumberRef = useRef("phoneNumber");
      // this.descriptionRef = useRef('description');
    }
    mounted() {
      this.phoneNumberRef.el.focus();
    }
    getPayload() {
      return {
        phoneNumber: this.state.phoneNumber,
        description: this.state.description,
      };
    }
  }
  PaymentRequestPopup.template = "PaymentRequestPopup";
  PaymentRequestPopup.defaultProps = {
    confirmText: _lt("Ok"),
    cancelText: _lt("Cancel"),
    title: "",
    phoneNumberPrefix: "",
  };

  Registries.Component.add(PaymentRequestPopup);

  return PaymentRequestPopup;
});
