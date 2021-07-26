//this file is where all custom implementations for nebula we would rather not do through bindings reside(Ex. request mutations)
const handleCaptchaRequestsInWindow = (window, html) => {
  window.webContents.session.protocol.interceptBufferProtocol(
    "https",
    (req, callback) => {
      const { host } = parse(req.url);

      if (!/signify|paypal|datadome|google|gstatic|monorail/i.test(host)) {
        window.webContents.session.protocol.uninterceptProtocol("https");

        return callback({
          mimeType: "text/html",
          data: Buffer.from(html),
        });
      }
    }
  );
};
