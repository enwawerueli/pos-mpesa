import logging
import json
import pprint
from datetime import datetime

from odoo import http
from odoo.http import request

_logger = logging.getLogger(__name__)


class PaymentController(http.Controller):
    @http.route(
        "/web/payment/mpesa/mpesa-express",
        type="json",
        auth="public",
        csrf=False,
        methods=["POST"],
        website=True,
    )
    def _mpesa_express_callback(self):
        data = json.loads(request.httprequest.data)
        _logger.debug("Mpesa Callback Info:\n%s", pprint.pformat(data))
        data = data["Body"]["stkCallback"]
        payment_request = (
            request.env["pos_mpesa.request"]
            .sudo()
            .search(
                [
                    (
                        "merchant_request_id",
                        "=",
                        data["MerchantRequestID"],
                    ),
                    (
                        "checkout_request_id",
                        "=",
                        data["CheckoutRequestID"],
                    ),
                ]
            )
        )
        if int(data["ResultCode"]) == 0:
            item = {i["Name"]: i["Value"] for i in data["CallbackMetadata"]["Item"]}
            payment_exists = (
                request.env["pos_mpesa.payment"]
                .sudo()
                .search_count(
                    [("mpesa_receipt_number", "=", item["MpesaReceiptNumber"])]
                )
            ) > 0
            if not payment_exists:
                request.env["pos_mpesa.payment"].sudo().create(
                    {
                        "mpesa_receipt_number": item["MpesaReceiptNumber"],
                        "phone_number": item["PhoneNumber"],
                        "amount": item["Amount"],
                        "transaction_date": datetime.strptime(
                            str(item["TransactionDate"]), "%Y%m%d%H%M%S"
                        ),
                        "balance": data["Balance"],
                        "request_id": payment_request.id,
                    }
                )
        payment_request.write(
            {
                "result_code": data["ResultCode"],
                "result_desc": data["ResultDesc"],
            }
        )
        return {
            "status": "OK",
            "description": "Request processed successfully",
        }
