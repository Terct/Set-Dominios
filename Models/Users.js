const mongoose = require('mongoose')
const User = mongoose.model('User',{
    Name: String,
    Pass: String,
    Email: String,
    Status: String
})

module.exports = User