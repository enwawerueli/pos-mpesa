# -*- coding: utf-8 -*-
{
    "name": "Mpesa Payment",
    "summary": """Mpesa Express payment terminal""",
    "description": """
        POS payment terminal integration with the Mpesa Express (STK Push) API
    """,
    "author": "Emz D <seaworndrift@gmail.com>",
    "website": "https://github.com/enwawerueli/pos-mpesa",
    # Categories can be used to filter modules in modules listing
    # Check https://github.com/odoo/odoo/blob/15.0/odoo/addons/base/data/ir_module_category_data.xml
    # for the full list
    "category": "Payment",
    "version": "0.1.0",
    # any module necessary for this one to work correctly
    "depends": ["base", "point_of_sale"],
    # always loaded
    "data": [
        "security/groups.xml",
        "security/ir.model.access.csv",
        "data/data.xml",
        "views/actions.xml",
        "views/menus.xml",
        "views/assets.xml",
        "views/views.xml",
    ],
    # only loaded in demonstration mode
    "demo": [],
    "assets": {
        "web.assets_qweb": [
            "pos_mpesa/static/src/xml/**/*",
        ],
        "point_of_sale.assets": [
            "pos_mpesa/static/src/js/**/*",
            "pos_mpesa/static/src/css/**/*",
        ],
    },
    "application": True,
}
