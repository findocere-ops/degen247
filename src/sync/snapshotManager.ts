import * as fs from 'fs';
import * as path from 'path';

export interface SnapshotState {
  lastCommitSha: string;
  lastSyncDate: string;
}

export class SnapshotManager {
  private fileDir: string;

  constructor(baseDir: string = './data') {
    this.fileDir = path.join(baseDir, 'SNAPSHOT.json');
    this.initialize();
  }

  private initialize() {
    if (!fs.existsSync(this.fileDir)) {
      this.saveSnapshot({
        lastCommitSha: 'INITIAL_BOOTSTRAP_SHA',
        lastSyncDate: new Date().toISOString()
      });
    }
  }

  public getSnapshot(): SnapshotState {
    const data = fs.readFileSync(this.fileDir, 'utf8');
    return JSON.parse(data) as SnapshotState;
  }

  public saveSnapshot(state: SnapshotState) {
    fs.writeFileSync(this.fileDir, JSON.stringify(state, null, 2));
  }
}
