export default {
  appname: "appsmith-chat-widget",
  sessionId: null,
  history: [{ role: "CHATBOT", message: "How can I help you today?" }],
  isSending: false,
  historyCap: 80, // keep latest 80 messages

  // --- Helpers ---
  ensureSession() {
    if (!this.sessionId) {
      const stored = appsmith.store.session_id;
      this.sessionId =
        stored || `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      storeValue("session_id", this.sessionId);
    }
  },
  lastUserMessage() {
    const last = this.history[this.history.length - 1];
    return last && last.role === "USER" ? last.message : "";
  },
  trimHistory() {
    const extra = this.history.length - this.historyCap;
    if (extra > 0) this.history.splice(0, extra);
  },
  replaceLastTyping(message) {
    for (let i = this.history.length - 1; i >= 0; i--) {
      if (this.history[i].role === "CHATBOT" && this.history[i].typing) {
        this.history[i] = { role: "CHATBOT", message };
        return;
      }
    }
    // fallback: if no typing placeholder, just push
    this.history.push({ role: "CHATBOT", message });
  },

  // --- Actions ---
  async submit() {
    const text = (inp_userPrompt.text || "").trim();
    if (!text || this.isSending) return this.history;

    this.history.push({ role: "USER", message: text });
    this.trimHistory();
    this.isSending = true;

    // show typing placeholder
    this.history.push({ role: "CHATBOT", message: "…", typing: true });
    storeValue(this.appname, this.history);

    try {
      await this.send();
    } finally {
      this.isSending = false;
      resetWidget("inp_userPrompt");
      storeValue(this.appname, this.history);
    }
    return this.history;
  },

  async send() {
    this.ensureSession();
    try {
      const response = await fetch(
        "https://n8n.atakumi.app/webhook/236676e5-3baf-4233-b07a-66f75445bcf9",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: this.sessionId,
            message: this.lastUserMessage(),
          }),
        }
      );

      const raw = await response.text();
      let data;
      try { data = JSON.parse(raw); } catch { data = raw; }

      let reply;
      if (Array.isArray(data)) {
        const first = data[0] || {};
        reply = first.output ?? first.reply ?? first.message ?? first.text ?? "No reply received.";
      } else if (data && typeof data === "object") {
        reply = data.output ?? data.reply ?? data.message ?? data.text ?? data.response ?? "No reply received.";
      } else {
        reply = String(data ?? "No reply received.");
      }

      this.replaceLastTyping(String(reply));
      this.trimHistory();
      storeValue(this.appname, this.history);
    } catch (err) {
      console.error("Error sending message:", err);
      this.replaceLastTyping("Error talking to the server.");
    }
  },

  // --- Meta ---
  totalResponses() {
    return this.history.filter((m) => m.role === "USER").length;
  },
  onload() {
    const chatHistory = appsmith.store[this.appname];
    if (chatHistory !== undefined) this.history = chatHistory;
    this.ensureSession();
  },
  reset() {
    removeValue(this.appname);
    removeValue("session_id");
    this.sessionId = null;
    this.history = [{ role: "CHATBOT", message: "How can I help you today?" }];
  },
  test() {
    console.log({
      history: this.history,
      sessionId: this.sessionId,
      totalUserMsgs: this.totalResponses(),
      stored: appsmith.store[this.appname],
    });
  },
};
