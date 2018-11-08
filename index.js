#! /usr/bin/env node

/**
 * This is CSV to QuickBooks IIF converter
 * Input format <DOMAIN_INFO|DESCRIPTION|QUANTITY|UNIT_CHARGE>
 *
 * Output will be written to ./output.iif
 * Usage:
 *
 *     node ./index.js <filename.csv>
 *
 */
var path = process.argv[1]
var file = process.argv[2]
var fs = require('fs')
var source = process.cwd() + '/' + file
var destination = process.cwd() + '/output.iif'
if (!file) {
    return console.log("You're going to need to specify a .csv file to process, or this will go nowhere.")
}

var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function roundTo(n, digits) {
    if (digits === undefined) {
        digits = 0;
    }

    var multiplicator = Math.pow(10, digits);
    n = parseFloat((n * multiplicator).toFixed(11));
    var test =(Math.round(n) / multiplicator);
    return +(test.toFixed(digits));
}

function main() {
    // console.log(path, file, process.argv);
    var csv = fs.readFileSync(source, 'utf8')
    var lines = csv.split('\r\n').slice(1)
    var columns
    var invoices = []

    var lastCustomer
    var currentCustomer
    var invoiceDate
    var currentInvoice
    for (var i = 0; i < lines.length; i++) {
        columns = lines[i].split('|')
        if (columns.length === 4) {
            currentCustomer = columns[0].slice(8) // Slice 'DOMAIN: ' part
            if (currentCustomer !== lastCustomer) { // Get invoice date from the first row description
                var usageEndDate = columns[1].split(' - ')[1]
                var usageEndDateArray = usageEndDate.split('/')
                var monthNum = months.indexOf(usageEndDateArray[0]) + 1
                invoiceDate = monthNum + '/' + usageEndDateArray[1] + '/' + usageEndDateArray[2]
                lastCustomer = currentCustomer
                currentInvoice = []
                invoices.push(currentInvoice)
                continue
            }
            var price = roundTo(columns[3], 2)
            currentInvoice.push({
                TRNSTYPE: 'INVOICE',
                DATE: invoiceDate,
                ACCNT: currentCustomer + ' Accounts Receivable',
                secondaryACCNT: currentCustomer + ' Income Account',
                NAME: currentCustomer,
                CLASS: '',
                AMOUNT: roundTo(columns[2] * price, 2),
                MEMO: columns[1],
                QNTY: columns[2],
                PRICE: columns[3],
                INVITEM: columns[1],
                TAXABLE: 'N',
                REIMBEXP: 'NOTHING'
            })
        }
    }

    fs.writeFileSync(destination, '!TRNS\tTRNSTYPE\tDATE\tACCNT\tNAME\tCLASS\tAMOUNT\tMEMO\n!SPL\tTRNSTYPE\tDATE\tACCNT\tNAME\tCLASS\tAMOUNT\tMEMO\tQNTY\tPRICE\tINVITEM\tTAXABLE\tREIMBEXP\n!ENDTRNS\n')
    format(invoices)
}

// Write to file single transaction for each DOMAIN with multiple distribution lines
function format(invoices) {
    var invoice
    var invoiceTotal
    var text
    for (var i = 0; i < invoices.length; i++) {
        invoice = invoices[i]
        invoiceTotal = invoice.reduce(function (total, transaction) {
            return total + transaction.AMOUNT
        }, 0)
        text = ""
        text += 'TRNS\t"' + invoice[0].TRNSTYPE + '"\t"' + invoice[0].DATE + '"\t"' + invoice[0].ACCNT + '"\t"' + invoice[0].NAME + '"\t"'
            + invoice[0].CLASS + '"\t"' + invoiceTotal + '"\t"' + invoice[0].MEMO + '"\n'
        for (var j = 0; j < invoice.length; j++) {
            var transaction = invoice[j]
            text += 'SPL\t"' + transaction.TRNSTYPE + '"\t"' + transaction.DATE + '"\t"' + transaction.secondaryACCNT + '"\t"' + transaction.NAME + '"\t"'
                + transaction.CLASS + '"\t"' + -1 * transaction.AMOUNT + '"\t"' + transaction.MEMO + '"\t"' + -1 * transaction.QNTY + '"\t"' + transaction.PRICE + '"\t"'
                + transaction.INVITEM + '"\t"' + transaction.TAXABLE + '"\t"' + transaction.REIMBEXP + '"\n'
        }
        text += "ENDTRNS\n"
        fs.appendFileSync(destination, text)
    }
}


main()
console.log('Output sent to ' + destination)