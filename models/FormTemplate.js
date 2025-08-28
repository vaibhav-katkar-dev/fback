const mongoose = require("mongoose");

const fieldSchemat = new mongoose.Schema({
  type: String,
  label: String,
  placeholder: String,
  required: Boolean,
  options: [String]
});

const formTemplateSchema = new mongoose.Schema({

  title: String,
  description:Number,
  info:String,
  fields: [fieldSchemat],
  token: String,
   // fixed status field
  status: {
    type: String,
    default: "template",
    immutable: true // makes it fixed, cannot be updated later
  }

});



module.exports = mongoose.model("FormTemplate", formTemplateSchema);
