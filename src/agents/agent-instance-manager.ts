import { assertNonEmptyValue } from "../guards/runtime-guards.js";

export interface AgentInstance {
  agentId: string;
  createdAt: string;
}

export interface AgentInstanceManagerOptions {
  maxInstances?: number;
}

export class AgentInstanceManager {
  private readonly instances = new Map<string, AgentInstance>();
  private readonly maxInstances: number;

  public constructor(options: AgentInstanceManagerOptions = {}) {
    this.maxInstances = options.maxInstances ?? 5_000;
  }

  public getOrCreate(agentId: string): AgentInstance {
    assertNonEmptyValue(agentId, "agentId");

    const existing = this.instances.get(agentId);
    if (existing) {
      return existing;
    }

    if (this.maxInstances > 0 && this.instances.size >= this.maxInstances) {
      const oldestId = this.instances.keys().next().value;
      if (oldestId !== undefined) {
        this.instances.delete(oldestId);
      }
    }

    const created: AgentInstance = {
      agentId,
      createdAt: new Date().toISOString()
    };

    this.instances.set(agentId, created);
    return created;
  }

  public get(agentId: string): AgentInstance | undefined {
    return this.instances.get(agentId);
  }

  public has(agentId: string): boolean {
    return this.instances.has(agentId);
  }

  public delete(agentId: string): boolean {
    return this.instances.delete(agentId);
  }

  public clear(): void {
    this.instances.clear();
  }

  public size(): number {
    return this.instances.size;
  }

  public list(): AgentInstance[] {
    return Array.from(this.instances.values());
  }
}
