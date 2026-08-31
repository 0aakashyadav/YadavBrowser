const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

class AgentSession {
  constructor(root) {
    this.root = root;
    this.dir = path.join(root, '.yb-agent');
    this.file = path.join(this.dir, 'session.json');
    this.state = {
      id: crypto.randomUUID(),
      startedAt: new Date().toISOString(),
      task: null,
      step: 0,
      status: 'idle',
      observations: [],
      actions: [],
      verification: []
    };
  }

  start(task) {
    this.state.task = task;
    this.state.status = 'running';
    this.state.startedAt = new Date().toISOString();
    this.persist();
    return this.state;
  }

  step() {
    this.state.step += 1;
    this.persist();
    return this.state.step;
  }

  observe(data) {
    this.state.observations.push({ at: new Date().toISOString(), data });
    this.state.observations = this.state.observations.slice(-20);
    this.persist();
  }

  action(name, detail = {}) {
    this.state.actions.push({ at: new Date().toISOString(), name, detail });
    this.state.actions = this.state.actions.slice(-50);
    this.persist();
  }

  verify(result) {
    this.state.verification.push({ at: new Date().toISOString(), result });
    this.state.verification = this.state.verification.slice(-20);
    this.persist();
  }

  finish(status = 'complete') {
    this.state.status = status;
    this.state.finishedAt = new Date().toISOString();
    this.persist();
    return this.state;
  }

  persist() {
    fs.mkdirSync(this.dir, { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(this.state, null, 2), 'utf8');
  }
}

module.exports = { AgentSession };
