$(function () {

    $(window).on('orderFormUpdated.vtex', (ev, orderForm) => {
        try {
            sendEventToIframe('setVisibility.vtex', true)
            sendEventToIframe('setActive.vtex', true)
            sendEventToIframe('setVisibility.vtex', true)
            sendEventToIframe('orderFormUpdated.vtex', orderForm)
        } catch (ex) {
            console.log(ex)
        }
    })

    function sendEventToIframe(ev, args) {
        try {
            $('#chk-card-form')[0]?.contentWindow?.postMessage({ event: ev, arguments: [args] }, "https://io.vtexpayments.com.br")
        } catch (error) {
            console.log(error)
        }
    }
})

var iframeReference = null

function loadPostRobotScript() {
    var script = document.createElement("script")
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/post-robot/10.0.35/post-robot.min.js"
    script.onload = init()
    document.head.appendChild(script)
}

function handlePaymentError() {
    console.log("HELP!")
}

function sendBankslipOptionPaymentData(ev) {
    var target = ev.target;
    window.vtexjs.checkout.getOrderForm().done(function (vtexOrderForm) {
        var pd = vtexOrderForm.paymentData
        pd.payments = [{
            paymentSystem: "6",
            installments: 1,
            referenceValue: vtexOrderForm.value,
            tokenId: null,
            value: vtexOrderForm.value
        }]
        vtexjs.checkout.sendAttachment("paymentData", pd).done(() => {
            $('.payment-opt').removeClass('active')
            $(target).addClass('active')
            $('#creditcard-container').hide()
        })
    })
}

function sendCreditCardOptionPaymentData(ev) {
    var target = ev.target;
    //TODO: Should handle creditcard options in another listnener
    window.vtexjs.checkout.getOrderForm().done(function (vtexOrderForm) {
        var pd = vtexOrderForm.paymentData
        pd.payments = [{
            paymentSystem: "2",
            installments: 1,
            referenceValue: vtexOrderForm.value,
            value: vtexOrderForm.value
        }]
        vtexjs.checkout.sendAttachment("paymentData", pd).done(() => {
            $('.payment-opt').removeClass('active')
            $(target).addClass('active')
            insertPaymentIframe('NEWCARD')
            $('#creditcard-container').show()
        })
    })
}

function sendSavedCreditCardOptionPaymentData(ev, savedCard) {
    var target = ev.target;
    //TODO: Should handle creditcard options (installments and values) in another listnener
    window.vtexjs.checkout.getOrderForm().done(function (vtexOrderForm) {
        var pd = vtexOrderForm.paymentData
        pd.payments = [{
            paymentSystem: savedCard.paymentSystem,
            installments: 1,
            accountId: savedCard.accountId,
            referenceValue: vtexOrderForm.value,
            value: vtexOrderForm.value
        }]
        vtexjs.checkout.sendAttachment("paymentData", pd).done(() => {
            $('.payment-opt').removeClass('active')
            $(target).addClass('active')
            insertPaymentIframe('SAVEDCARD')
            $('#creditcard-container').show()
        })
    })
}

async function sendPaymentData(transactionData) {
    //TODO: Must create an array of Payments if there is more than one - removing forced index 0.
    var allPayments = [{
        "transaction": {
            "id": transactionData.id,
            "merchantName": transactionData.paymentData.payments[0].merchantSellerPayments[0].merchantName
        },
        "paymentSystem": transactionData.paymentData.payments[0].paymentSystem,
        "installments": transactionData.paymentData.payments[0].installments,
        "value": transactionData.paymentData.payments[0].value,
        "referenceValue": transactionData.paymentData.payments[0].referenceValue,
        "accountId": transactionData.paymentData.payments[0].accountId,
        "bin": transactionData.paymentData.payments[0].bin
    }]

    var receiverUri = transactionData.receiverUri
    var orderGroupId = transactionData.orderGroup
    var gatewayCallbackTemplatePath = transactionData.gatewayCallbackTemplatePath
    var transactionId = transactionData.id

    var hasSensitiveData = true; //TRUE = has CreditCard
    if (hasSensitiveData) {
        try {
            await postRobot.send(document.querySelector("#chk-card-form").contentWindow, 'sendPayments',
                {
                    payments: allPayments,
                    receiverUri,
                    orderId: orderGroupId,
                    gatewayCallbackTemplatePath,
                    transactionId,
                })
        } catch (err) {
            handlePaymentError()
            return
        }
    } else {
        var payment_url = "/api/payments/pub/transactions/" + transactionData.id + "/payments?orderId=" + orderGroupId
        const paymentsResponse = await fetch(payment_url,
            {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(allPayments),
            })
        if (paymentsResponse.status !== 201) {
            handlePaymentError()
            return
        }
    }
}

async function gatewayCallback(transactionData) {
    var callback_url = "/api/checkout/pub/gatewayCallback/" + transactionData.orderGroup

    fetch(callback_url, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
    }).then(res => console.log(res))
}

function placeOrder() {
    window.vtexjs.checkout.getOrderForm().done(function (vtexOrderForm) {
        var transaction_url = "/api/checkout/pub/orderform/" + vtexOrderForm.orderFormId + "/transaction"
        var transaction_content = {
            "referenceId": vtexOrderForm.orderFormId,
            "value": vtexOrderForm.value,
            "referenceValue": vtexOrderForm.value,
            "savePersonalData": false,
            "optinNewsLetter": false
        }

        fetch(transaction_url, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(transaction_content)
        }).then(res =>
            //TODO: Handle errors before parsing response!
            res.json()
        ).then(function (transactionData) {
            sendPaymentData(transactionData, vtexOrderForm.value).then(function () {
                //TODO: Handle error messages before going further!
                gatewayCallback(transactionData)
            })
        })
    })
}

function getSavedCards(vtexOrderForm) {
    return vtexOrderForm.paymentData.availableAccounts
}

function initUserInterface(vtexOrderForm) {
    var payments_container = $("<div/>", {
        class: 'pull-right payment-data span12',
        id: 'payments-v2'
    })
    var section_title = $("<div/>", {
        text: "Payments V2!"
    })
    payments_container.append(section_title)
    $('.orderform-template-holder').append(payments_container)

    var button_bankslip_opt = $("<button/>", {
        class: 'btn btn-success btn-large payment-opt',
        text: "Pagar com boleto",
        id: 'payments-v2-btn-bankslip'
    })
    button_bankslip_opt.on('click', ev => sendBankslipOptionPaymentData(ev))
    payments_container.append(button_bankslip_opt)

    var button_creditcard_opt = $("<button/>", {
        class: 'btn btn-success btn-large payment-opt',
        text: "Pagar com cartão de crédito",
        id: 'payments-v2-btn-creditcard'
    })
    button_creditcard_opt.on('click', ev => sendCreditCardOptionPaymentData(ev))
    payments_container.append(button_creditcard_opt)

    //Handle saved cards 
    //TODO: Only perform this request if there is an identified user
    var savedCards = []
    savedCards = getSavedCards(vtexOrderForm)

    if (savedCards.length != 0) {
        //TODO: For each savedCard in array...
        var savedCard_text = savedCards[0].paymentSystemName + " final " + savedCards[0].cardNumber.slice(-4)
        var button_savedcreditcard_opt = $("<button/>", {
            class: 'btn btn-success btn-large payment-opt',
            text: "Pagar com " + savedCard_text,
            id: 'payments-v2-btn-savedcreditcard'
        })
        button_savedcreditcard_opt.on('click', ev => sendSavedCreditCardOptionPaymentData(ev, savedCards[0]))
        payments_container.append(button_savedcreditcard_opt)
    }

    var creditcard_container = $("<div/>", {
        class: 'pull-right payment-data span12',
        id: 'creditcard-container'
    })
    payments_container.append(creditcard_container)

    var button_place_order = $("<button/>", {
        class: 'submit btn btn-success btn-large btn-block',
        text: "Finalizar pedido!",
        id: 'payments-v2-btn-act1'
    })
    button_place_order.on('click', placeOrder)
    $('.payment-confirmation-wrap').append(button_place_order)

}

function insertPaymentIframe(type) {
    const IFRAME_APP_VERSION = '1.20.0'
    const iframeURLProd = "https://io.vtexpayments.com.br/card-ui/" + IFRAME_APP_VERSION + "/index.html";

    var iframe_src_opt = "?css=/files/checkout6-custom.css&locale=pt-BR&cardType=new&id=" + (new Date().getTime() * -1).toString() + Math.random().toString(36).substr(2) + "&retry=2&paymentGroup=creditCardPaymentGroup&fallbackLocale=pt-BR&accountName=vtexprojectcheckoutapp&origin=https://vtexprojectcheckoutapp.myvtex.com"
    if (type != 'NEWCARD') iframe_src_opt = "?css=/files/checkout6-custom.css&locale=pt-BR&cardType=saved&id=" + (new Date().getTime() * -1).toString() + Math.random().toString(36).substr(2) + "&retry=2&paymentGroup=creditCardPaymentGroup&fallbackLocale=pt-BR&accountName=vtexprojectcheckoutapp&origin=https://vtexprojectcheckoutapp.myvtex.com"

    var paymentIframe = $("<iframe/>", {
        id: "chk-card-form",
        class: "some-className",
        scrolling: "no",
        frameBorder: "0",
        onload: setupPaymentIframe(),
        src: iframeURLProd + iframe_src_opt
    })
    $('#creditcard-container').empty().append(paymentIframe)
}

function setupPaymentIframe() {
    radio("paymentData.paymentGroup.iFrame.creditCardPaymentGroup.sendOrderForm").broadcast();

    window.vtexjs.checkout.getOrderForm().done(function (vtexOrderForm) {
        var paymentSystems = vtexOrderForm.paymentData.paymentSystems
        var creditCardPaymentSystems = paymentSystems.filter((paymentSystem) => paymentSystem.groupName === 'creditCardPaymentGroup')

        setTimeout(async function () {
            await postRobot.send(document.querySelector("#chk-card-form").contentWindow, 'setup', {
                stylesheetsUrls: [
                    "https://vtexprojectcheckoutapp.myvtex.com/files/checkout6-custom.css",
                    "https://unpkg.com/tachyons@4/css/tachyons.min.css",
                    "https://io.vtex.com.br/front-libs/font-awesome/3.2.1/css/font-awesome.min.css"
                ],
                paymentSystems: creditCardPaymentSystems,
            })
            radio("paymentData.paymentGroup.iFrame.creditCardPaymentGroup.sendOrderForm").broadcast();

        }, 1000);
    })

}


//Post-Robot interface
function createPaymentSystemListener() {
    const listener = postRobot.on('paymentSystem', ({ data }) => {
        //setSelectedPaymentSystem(data)
        console.log('PaymentSystem:', data)
    })
    return () => listener.cancel()
}

function init() {
    console.log('Doing something nasty')
    window.vtexjs.checkout.getOrderForm().done(function (vtexOrderForm) {
        //initProductList(vtexOrderForm)
        initUserInterface(vtexOrderForm)
        //insertPaymentIframe()

        //Post-Robot interface init
        createPaymentSystemListener()
    })
}

window.addEventListener('load', function () {
    loadPostRobotScript() //only needed when you don't control HTML initial rendering
    //init()
})
