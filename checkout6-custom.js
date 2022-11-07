$(function () {
    $(window).on('orderFormUpdated.vtex', (ev, orderForm) => {
        try {
            sendEventToIframe('setVisibility.vtex', true);
            sendEventToIframe('setActive.vtex', true);
            sendEventToIframe('setVisibility.vtex', true);
            sendEventToIframe('orderFormUpdated.vtex', orderForm);
        } catch (ex) {
            console.log('Erro ao enviar eventos para o iframe no orderFormUpdated.vtex', ex);
        }
    });

    $(window).on("message onmessage", function(e) {
        if(e.originalEvent.data && e.originalEvent.data.event) {
			
			if(e.originalEvent.data.event == 'startTransaction.vtex') {
				console.log(e.originalEvent.data);
			}

			if(e.originalEvent.data.event == 'preSubmit.vtex') {
				console.log(e.originalEvent.data);
                sendEventToIframe('preSubmit.vtex', true);
			}

            if(e.originalEvent.data.event == 'startTransaction.vtex') {
				console.log(e.originalEvent.data);
                placeOrder()
			}
			
			if(e.originalEvent.data.event == 'paymentSuccess.vtex') {
				const myArray = e.originalEvent.data.arguments[0].split("/");
				gatewayCallback(myArray[3]);
			}
			
			if(e.originalEvent.data.event == 'setIFrameHeight.vtex') {
				$('#chk-card-form')[0].style.setProperty('height', e.originalEvent.data.arguments[1] + 'px', 'important');
			}
			
			if(e.originalEvent.data.event == 'updatePayments.vtex' || e.originalEvent.data.event == 'setInstallmentsPreview.vtex') {
				let updatePaymentsIframe = e.originalEvent.data.arguments;
				
				if(updatePaymentsIframe != null && updatePaymentsIframe.length > 0) {
					updatePaymentData({payments:e.originalEvent.data.arguments[0]});
				}
			}
			
			if(e.originalEvent.data.event == 'removeCardAccount.vtex') {
				removeSavedCard(e.originalEvent.data.arguments);
			}
		}
    });
    
	$(window).on('payment-changed', function(evt) {
		setTimeout(function() {
			vtexjs.checkout.getOrderForm().done(function(orderForm) {
				sendEventToIframe('orderFormUpdated.vtex', orderForm)
			});
		}, 1000);
	});

});

async function finalizarCompraCartaoCredito(recaptchaToken) {	
	if(recaptchaToken || !verificarSePossuiRecaptcha()) {
		vtexjs.checkout.getOrderForm().done(function (orderForm) {
			setLoader();
			
			sendEventToIframe('orderFormUpdated.vtex', orderForm);
			
			let transactionData = {
				"referenceId": orderForm.orderFormId,
				"value": orderForm.value,
				"referenceValue": orderForm.value,
				"savePersonalData": true,
				"optinNewsLetter": orderForm.optinNewsLetter
			}
			

			if(GLOBAL_ORDERFORM.recaptchaKey) {
				transactionData = {
					"referenceId": orderForm.orderFormId,
					"value": orderForm.value,
					"referenceValue": orderForm.value,
					"savePersonalData": true,
					"optinNewsLetter": orderForm.optinNewsLetter, 
					"recaptchaKey": GLOBAL_ORDERFORM.recaptchaKey,
					"recaptchaToken": recaptchaToken
				}
			}
			
			placeOrder()
		})
	}
}

function placeOrder(){
			$.ajax({
				url : '/api/checkout/pub/orderform/' + orderForm.orderFormId + '/transaction',
				contentType: 'application/json',
				dataType: "json",
				type: "POST",
				data: JSON.stringify(transactionData),
				success : function(responseTransaction) {

					let receiverUri = responseTransaction.receiverUri;
					let transactionId = responseTransaction.id;
					
					var allPayments = [];
					
					$(responseTransaction.paymentData.payments).each(function(i, payment) {
						$(payment.merchantSellerPayments).each(function(j, mechantSellerPayment) {
							let merchantTransactionSelected = responseTransaction.merchantTransactions.filter((merchantResponse) => merchantResponse.id == mechantSellerPayment.id)[0];
							
							let paymentItem = {
								"transaction": {
									"id": merchantTransactionSelected.transactionId,
									"merchantName": merchantTransactionSelected.merchantName
								},
								"id" : merchantTransactionSelected.id,
								"paymentSystem": payment.paymentSystem,
								"fields": {
									"deviceFingerprint": deviceFingerprintIdCSV4
								},
								"installments": mechantSellerPayment.installments,
								"installmentsValue": mechantSellerPayment.installmentValue,
								"value": mechantSellerPayment.value,
								"referenceValue": mechantSellerPayment.referenceValue
							};
							
							paymentItem.hasDefaultBillingAddress = true;
							paymentItem.isBillingAddressDifferent = false;
							paymentItem.bin = payment.bin;
							paymentItem.currencyCode = 'BRL';
							paymentItem.originalPaymentIndex = 0;
							if(payment.accountId != null && payment.accountId != '') {
								paymentItem.accountId = payment.accountId;
							}
							
							allPayments.push(paymentItem);
						});
					});
					
					var sessionId = getSessionId();
					var macId = getMacId();
					var extraData = {
						sessionId: sessionId,
						macId: macId,
						receiverUri,
						version: '1.20.0', layer: 'card-ui', transactionId: transactionId,  orderFormId: window.vtexjs.checkout.orderForm.orderFormId
					}
					
					$('#chk-card-form')[0]?.contentWindow?.postMessage({ event: 'sendPayments.vtex', arguments: [
						allPayments,
						responseTransaction,
						extraData
					]}, "https://io.vtexpayments.com.br");

				},
				error: function(jqXHR, textStatus, errorThrown) {
					console.log(JSON.parse(jqXHR.responseText).error.message);

				}
			});
}

function updatePaymentData(data) {
	
	var aditionalData = ["items", "totalizers", "clientProfileData", "shippingData", "paymentData", "sellers", "messages", "marketingData", "clientPreferencesData", "storePreferencesData", "giftRegistryData", "ratesAndBenefitsData", "openTextField", "commercialConditionData", "customData"]
	data.expectedOrderFormSections = aditionalData;
	
    var callback_url = "/api/checkout/pub/orderForm/"+ vtexjs.checkout.orderForm.orderFormId + "/attachments/paymentData";
	
    fetch(callback_url, {
        method: 'POST',
        body:JSON.stringify(data)
    }).then((response) => response.json())
  	.then((data) => {
		vtexjs.checkout.getOrderForm().done(function(orderForm) {
			sendEventToIframe('orderFormUpdated.vtex', orderForm);
		});
	});
}

function removeSavedCard(accountId) {
	vtexjs.checkout.getOrderForm().then(function(orderForm) {
		return vtexjs.checkout.removeAccountId(accountId);
	}).then(function(orderForm) {
		sendEventToIframe('orderFormUpdated.vtex', orderForm);
	});
}

async function gatewayCallback(orderGroupId) {
	$.post('/api/checkout/pub/gatewayCallback/' + orderGroupId, function(responseGatewayCallBack) {
		apresentarMensagemPagamentoSucessoConcluido();

		setTimeout(function() {
			window.location.href = '/checkout/orderPlaced/?og=' + orderGroupId;
		},2000);
	})
	.fail(function(jqXHR, textStatus, errorThrown) {
		console.log(JSON.parse(jqXHR.responseText).error.message, 'danger');

	});
}

function insertPaymentIframe(type) {
    const IFRAME_APP_VERSION = '1.20.0';
    const iframeURLProd = 'https://io.vtexpayments.com.br/card-ui/' + IFRAME_APP_VERSION + '/index.html';
	const typeCard = type != 'NEWCARD' ? 'saved' : 'new';

    const iframe_src_opt = "?css=/arquivos//checkout6-custom.css?locale=pt-BR&cardType=" + typeCard + "&id=" + (new Date().getTime() * -1).toString() + Math.random().toString(36).substr(2) + "&retry=2&paymentGroup=creditCardPaymentGroup&fallbackLocale=pt-BR&accountName=" + vtex.vtexid.accountName + "&origin=" + window.location.origin;

    var paymentIframe = $("<iframe/>", {
        id: "chk-card-form",
        class: "some-className",
        scrolling: "no",
        frameBorder: "0",
        src: iframeURLProd + iframe_src_opt
    })
    $('#creditcard-container').empty().append(paymentIframe);
	
	window.dispatchEvent(new Event('payment-changed'));
}

//Helpers
function sendEventToIframe(ev, args) {
    try {
        $('#chk-card-form')[0]?.contentWindow?.postMessage({ event: ev, arguments: [args] }, "https://io.vtexpayments.com.br");
    } catch (error) {
        console.log(error)
    }
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
