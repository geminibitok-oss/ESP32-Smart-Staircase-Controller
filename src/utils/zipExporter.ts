import JSZip from 'jszip';
import { StaircaseConfig } from '../types';
import { generateProjectFiles } from '../data/codeTemplates';

export async function downloadProjectAsZip(config: StaircaseConfig, onProgress?: (percent: number) => void): Promise<void> {
  const zip = new JSZip();
  const files = generateProjectFiles(config);

  for (const file of files) {
    zip.file(file.path, file.content);
  }

  const content = await zip.generateAsync({ type: 'blob' }, (metadata) => {
    if (onProgress) onProgress(metadata.percent);
  });

  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${config.githubRepo || 'esp32-stairs-controller'}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
