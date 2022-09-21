$(function () {

    $(window).on('orderFormUpdated.vtex', (ev, orderForm) => {
        try {
            sendEventToIframe('setVisibility.vtex', true)
            sendEventToIframe('setActive.vtex', true)
            sendEventToIframe('setVisibility.vtex', true)
            sendEventToIframe('orderFormUpdated.vtex', orderForm)
            console.log("orderFormUpdated.vtex")
        } catch (ex) {
            console.log(ex)
        }
    })

    $(window).on("message onmessage", function(e) {
        console.log(e.originalEvent.data.event)
        console.log(e.originalEvent.data.arguments)
        
        if(e.originalEvent.data.event == 'paymentSuccess.vtex'){
            const myArray = e.originalEvent.data.arguments[0].split("/");
            gatewayCallback(myArray[3])
        }
    })
    
})

function sendEventToIframe(ev, args) {
    try {
        $('#chk-card-form')[0]?.contentWindow?.postMessage({ event: ev, arguments: [args] }, "https://io.vtexpayments.com.br")
    } catch (error) {
        console.log(error)
    }
}

var iframeReference = null

function handlePaymentError(err) {
    console.log("HELP!")
    console.log("erro", err)
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

getCookie = function(cookieName) {
    return ("; " + document.cookie).split("; " + cookieName + "=").pop().split(";").shift()
}

getSessionId = function() {
    return getCookie("VtexRCSessionIdv7")
}
,
getMacId = function() {
    return getCookie("VtexRCMacIdv7")
}

async function sendPaymentData(transactionData) {
    

    var deviceFingerprintIdCSV4 = 10000000 + Math.floor(Math.random() * 99999999);
    (function (a, b, c, d, e, f, g) {
    a['CsdpObject'] = e; a[e] = a[e] || function () {
    (a[e].q = a[e].q || []).push(arguments)
    }, a[e].l = 1 * new Date(); f = b.createElement(c),
    g = b.getElementsByTagName(c)[0]; f.async = 1; f.src = d; g.parentNode.insertBefore(f, g)
    })(window, document, 'script', '//device.clearsale.com.br/p/fp.js', 'csdp');
    csdp('app', 'seu-app');
    csdp('sessionid', deviceFingerprintIdCSV4);

    var allPayments = [{
        transaction: {
            id: transactionData.id,
            merchantName: transactionData.paymentData.payments[0].merchantSellerPayments[0].id
        },
        id:transactionData.paymentData.payments[0].merchantSellerPayments[0].id,

        paymentSystem: transactionData.paymentData.payments[0].paymentSystem,
        fields: {
            deviceFingerprint: deviceFingerprintIdCSV4
        },
        hasDefaultBillingAddress: true,
        isBillingAddressDifferent: false,
        installments: transactionData.paymentData.payments[0].installments,
        value: transactionData.paymentData.payments[0].value,
        referenceValue: transactionData.paymentData.payments[0].referenceValue,
        accountId: transactionData.paymentData.payments[0].accountId,
        bin: transactionData.paymentData.payments[0].bin,
        currencyCode: "BRL",
        originalPaymentIndex: 0
    }]

    var receiverUri = transactionData.receiverUri
    var orderGroupId = transactionData.orderGroup
    var transactionId = transactionData.id
    var sessionId = getSessionId()
    var macId = getMacId()
    var extraData = {
        sessionId: sessionId,
        macId: macId,
        receiverUri,
        version: '1.20.0', layer: 'card-ui', transactionId: transactionId, 
                orderFormId: window.vtexjs.checkout.orderForm.orderFormId
    }

    var hasSensitiveData = true; //TRUE = has CreditCard
    if (hasSensitiveData) {
        try {
            $('#chk-card-form')[0]?.contentWindow?.postMessage({ event: 'sendPayments.vtex', arguments: [
                allPayments,
                transactionData,
                extraData
            ]}, "https://io.vtexpayments.com.br")

            
        } catch (err) {
            handlePaymentError(err)
            return err
        }
    } 
}

async function gatewayCallback(orderGroup) {
    var callback_url = "/api/checkout/pub/gatewayCallback/" + orderGroup

    fetch(callback_url, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
    }).then(res => {
        console.log(res)
        window.location.href = '/checkout/orderPlaced/?og='+orderGroup
    })
}

function placeOrder() {
    window.vtexjs.checkout.getOrderForm().done(function (vtexOrderForm) {
        sendEventToIframe('orderFormUpdated.vtex', vtexOrderForm)
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
            res.json()
        ).then(function (transactionData) {
            sendPaymentData(transactionData, vtexOrderForm.value).then(function (err) {
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
    insertPaymentIframe("NEWCARD");
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
        src: iframeURLProd + iframe_src_opt
    })
    $('#creditcard-container').empty().append(paymentIframe)
}

function init() {
    console.log('Doing something nasty')
    window.vtexjs.checkout.getOrderForm().done(function (vtexOrderForm) {
        initUserInterface(vtexOrderForm)
    })
}
                                            
window.addEventListener('load', function () {
   init()
})

