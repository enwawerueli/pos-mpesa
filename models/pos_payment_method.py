from odoo import models, fields


class PosPaymentMethod(models.Model):
    _inherit = "pos.payment.method"

    config_id = fields.Reference(
        [("pos_mpesa.config", "Mpesa Configuration")], "Configuration"
    )

    def _get_payment_terminal_selection(self):
        return super()._get_payment_terminal_selection() + [
            ("mpesa_express", "Mpesa Express")
        ]
