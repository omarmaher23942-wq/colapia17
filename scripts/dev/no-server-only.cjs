// no-server-only.cjs — لسكربتات التطوير فقط: يجعل `import "server-only"` بلا أثر خارج Next (الحارس مخصص لحزم المتصفح).
const Module = require("node:module");
const orig = Module._resolveFilename;
const empty = require.resolve("./empty.cjs");
Module._resolveFilename = function (request, ...rest) {
  if (request === "server-only") return empty;
  return orig.call(this, request, ...rest);
};
