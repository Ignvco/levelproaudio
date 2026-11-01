// Preserve JSON values while making the text safe inside an HTML script block,
// including future server rendering or static exports.
const escapes = { "<": "\\u003c", ">": "\\u003e", "&": "\\u0026", "\u2028": "\\u2028", "\u2029": "\\u2029" }
export function serializeJsonLd(data) {
  return JSON.stringify(data)?.replace(/[<>&\u2028\u2029]/g, character => escapes[character])
}
