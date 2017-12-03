const WebSocket = require('ws');

module.exports = (server, db) => {
    const wss = new WebSocket.Server({ server });

    function sendJSON(ws, data) {
        ws.send(JSON.stringify(data));
    }

    async function getAvailable(ws, msg) {
        if (msg['date']) {
            let date = msg['date'];

            if (typeof date !== 'string') {
                throw 'Bad Request ("date" is not a string)';
            }

            date = date.split('-');

            if (date.length !== 3) {
                throw 'Bad Request ("date" must be in the format "YYYY-MM-DD")';
            }

            let available;

            try {
                available = await db.dayAvailable(
                    new Date(Date.UTC(date[0], date[1] - 1, date[2]))
                );
            } catch (e) {
                throw 'Server Error (DB access failed)';
            }

            return {
                available: available
            };
        } else {
            throw 'bad request ("date" missing)';
        }
    }

    function validateEmail(email) {
        var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return re.test(email);
    }

    async function addBooking(ws, msg) {
        if (msg['booking']) {
            let booking = msg['booking'];
            console.log(booking);
            if (booking.name.length < 1) {
                throw 'Name is required';
            }
            if (!validateEmail(booking.email)) {
                throw 'not valid emailadress!';
            }

            try {
                booking = await db.addBooking(
                    booking.name,
                    booking.email,
                    booking.date,
                    booking.amountGuests,
                    booking.text
                );
            } catch (e) {
                throw 'Server Error (DB access failed)';
            }
            return booking;
        } else {
            throw 'bad request ("booking" missing)';
        }
    }

    wss.on('connection', (ws, req) => {
        ws.on('message', msg => {
            (async function() {
                let err;

                try {
                    msg = JSON.parse(msg);

                    const func = {
                        getAvailable: getAvailable,
                        addBooking: addBooking
                    }[msg['request']];

                    if (func) {
                        try {
                            let result = await func(ws, msg);

                            result['result'] = 'ok';
                            result['id'] = msg['id'];

                            sendJSON(ws, result);
                        } catch (e) {
                            err = e;
                        }
                    } else {
                        err = 'Bad Request (function not found)';
                    }
                } catch (_) {
                    err = 'Invalid JSON';
                }

                if (err) {
                    try {
                        sendJSON(ws, {
                            result: err,
                            id: msg['id']
                        });
                    } catch (e) {
                        console.error('Failed to send error message: ');
                        console.error(err);
                    }
                }
            })();
        });
    });
};
