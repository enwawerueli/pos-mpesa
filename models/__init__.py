import logging
import pprint
import math
from datetime import datetime

from odoo import models, fields, api
from mpesa_connect import App, Authorization, STKPush
from mpesa_connect.utils import generate_password

from . import pos_payment_method

_logger = logging.getLogger(__name__)


class Config(models.Model):
    _name = "pos_mpesa.config"
    _description = "Mpesa Configuration"

    name = fields.Char(required=True, default="Mpesa Express")
    business_short_code = fields.Char("Business Short Code", required=True)
    account_reference = fields.Char("Account Name", required=True)
    transaction_desc = fields.Char("Transaction Description", required=True)
    pass_key = fields.Char("Pass Key", required=True)
    consumer_key = fields.Char("Consumer Key", required=True)
    consumer_secret = fields.Char("Consumer Secret", required=True)
    environment = fields.Selection(
        [("sandbox", "Sandbox"), ("production", "Production")],
        required=True,
        default="sandbox",
    )


class Request(models.Model):
    _name = "pos_mpesa.request"
    _description = "Mpesa Payment Requests"

    merchant_request_id = fields.Char(required=True)
    checkout_request_id = fields.Char(required=True)
    response_code = fields.Integer()
    response_desc = fields.Char()
    result_code = fields.Integer()
    result_desc = fields.Char()


class Payment(models.Model):
    _name = "pos_mpesa.payment"
    _description = "Mpesa Payments"

    request_id = fields.Many2one("pos_mpesa.request", ondelete="restrict")
    mpesa_receipt_number = fields.Char("Transaction ID", required=True)
    phone_number = fields.Char(required=True)
    amount = fields.Float(required=True)
    balance = fields.Float()
    transaction_date = fields.Datetime(required=True)

    _sql_constraints = [
        (
            "request_id_unique",
            "UNIQUE(request_id)",
            "The payment request id must be unique",
        ),
        (
            "mpesa_receipt_number_unique",
            "UNIQUE(mpesa_receipt_number)",
            "The payment receipt number must be unique",
        ),
    ]

    @api.model
    def stk_push(self, request_info):
        _logger.debug("Initiate STK Push:\n%s", pprint.pformat(request_info))
        payment_method = self.env["pos.payment.method"].search(
            [("id", "=", request_info["PaymentMethod"])]
        )
        config = self.env["pos_mpesa.config"].search(
            [("id", "=", payment_method.config_id.id)]
        )
        app = App(
            domain=config.environment,
            consumer_key=config.consumer_key,
            consumer_secret=config.consumer_secret,
        )
        auth = Authorization(app)
        auth_result = auth.generate_token()
        _logger.debug("Auth Response:\n%s", pprint.pformat(auth_result))
        if auth_result.response.status_code != 200:
            return auth_result.response.json()
        stk_push = STKPush(app, access_token=auth_result.access_token)
        stk_push_result = stk_push.process_request(
            business_short_code=config.business_short_code,
            account_reference=config.account_reference,
            call_back_url=f"{self.env['ir.config_parameter'].get_param('web.base.url')}/web/payment/mpesa-express",
            password=generate_password(
                business_short_code=config.business_shortcode,
                pass_key=config.pass_key,
                timestamp=(timestamp := datetime.now().strftime("%Y%m%d%H%M%S")),
            ),
            timestamp=timestamp,
            phone_number=request_info["PhoneNumber"],
            amount=1
            if config.environment == "sandbox"
            else math.ceil(float(request_info["Amount"])),
            transaction_desc=request_info["Description"] or config.transaction_desc,
        )
        _logger.debug("STK Push Response:\n%s", pprint.pformat(stk_push_result))
        if stk_push_result.response.status_code != 200:
            return stk_push_result.response.json()
        self.env["pos_mpesa.request"].sudo().create(
            {
                "merchant_request_id": stk_push_result.merchant_request_id,
                "checkout_request_id": stk_push_result.checkout_request_id,
                "response_code": stk_push_result.response_code,
                "response_desc": stk_push_result.response_description,
            }
        )
        return stk_push_result.response.json()

    @api.model
    def check_payment(self, request_info):
        _logger.debug("Check Payment:\n%s", pprint.pformat(request_info))
        payment_request = (
            self.env["pos_mpesa.request"]
            .sudo()
            .search(
                [
                    (
                        "merchant_request_id",
                        "=",
                        request_info["MerchantRequestID"],
                    ),
                    (
                        "checkout_request_id",
                        "=",
                        request_info["CheckoutRequestID"],
                    ),
                ]
            )
        )
        if int(payment_request.result_code) == 0 and (
            payment := (
                self.env[self._name]
                .sudo()
                .search([("request_id", "=", payment_request.id)])
            )
        ):
            return {
                "status": "SUCCESS",
                "message": payment_request.result_desc,
                "mpesa_receipt_number": payment.mpesa_receipt_number,
            }
        if code := payment_request.result_code:
            return {
                "status": "FAILED",
                "code": code,
                "message": payment_request.result_desc,
            }
        return {"status": "PENDING"}
