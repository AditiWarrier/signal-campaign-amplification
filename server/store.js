const fs = require('node:fs/promises');
const path = require('node:path');

function emptyState() {
  return { version: 1, campaigns: [], demoContributions: [], activity: [] };
}

function copy(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

class JsonStore {
  constructor(filePath = path.resolve(process.cwd(), '.data', 'signal-api.json')) {
    this.filePath = filePath;
    this.queue = Promise.resolve();
  }

  async read() {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const state = JSON.parse(raw);
      if (state?.version !== 1 || !Array.isArray(state.campaigns) || !Array.isArray(state.demoContributions) || !Array.isArray(state.activity)) {
        throw new Error('Local SIGNAL API data file has an unsupported format.');
      }
      return copy(state);
    } catch (error) {
      if (error && error.code === 'ENOENT') return emptyState();
      throw error;
    }
  }

  async update(mutator) {
    const task = this.queue.catch(() => undefined).then(async () => {
      const state = await this.read();
      const result = await mutator(state);
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      const temporaryPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
      await fs.writeFile(temporaryPath, JSON.stringify(state, null, 2), { encoding: 'utf8', flag: 'wx' });
      await fs.rename(temporaryPath, this.filePath);
      return copy(result);
    });
    this.queue = task.then(() => undefined, () => undefined);
    return task;
  }
}

class MemoryStore {
  constructor(initial = emptyState()) {
    this.state = copy(initial);
    this.queue = Promise.resolve();
  }

  async read() { return copy(this.state); }

  async update(mutator) {
    const task = this.queue.catch(() => undefined).then(async () => {
      const result = await mutator(this.state);
      return copy(result);
    });
    this.queue = task.then(() => undefined, () => undefined);
    return task;
  }
}

module.exports = { JsonStore, MemoryStore };
