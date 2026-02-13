import { unzip } from 'react-native-zip-archive';
import RNFS from 'react-native-fs';
import StaticServer from '@dr.pogodin/react-native-static-server';

let server = null;
let serverOrigin = null;

const SERVER_PORT = 8080;


/**
 * Root folder name inside app document directory
 */
const CONTENT_DIR = 'web_content';

/**
 * Start local static server (singleton)
 */
export const startServer = async () => {
  if (server && serverOrigin) {
    return serverOrigin;
  }

  
  await ensureContentDirectory();

  if (!CONTENT_ROOT) {
    throw new Error('CONTENT_ROOT is undefined or empty');
  }

  try {
    server = new StaticServer({
      port: SERVER_PORT,
      fileDir: CONTENT_ROOT,
    });

    serverOrigin = await server.start();
    return serverOrigin; // http://localhost:8080
  } catch (error) {
    console.error('StaticServer creation error:', error);
    throw error;
  }
};

/**
 * Stop local static server
 */
export const stopServer = async () => {
  if (server) {
    await server.stop();
    server = null;
    serverOrigin = null;
  }
};


/**
 * Get the base directory for storing web content
 * * Example:
 * iOS:    /var/mobile/.../Documents/web_content
 * Android:/data/user/0/.../files/web_content
 */
export const CONTENT_ROOT = `${RNFS.DocumentDirectoryPath}/${CONTENT_DIR}`;

/**
 * Returns absolute content root path
 */
export const getContentDirectory = () => CONTENT_ROOT;

/**
 * GET a file:// URL for a file inside content root
 * Used mainly for WebView loading
 */
export const getFileUrl = (relativePath = 'index.html') => {
  const dir = getContentDirectory();
  return `file://${dir}/${relativePath}`;
};

/**
 * Ensure the content directory exists
 */
export const ensureContentDirectory = async () => {
  try {
    const exists = await RNFS.exists(CONTENT_ROOT);
    if (!exists) {
      await RNFS.mkdir(CONTENT_ROOT);
    }
    return CONTENT_ROOT;
  } catch (error) {
    console.error('Failed to ensure content directory:', error);
    throw error;
  }
};

/**
 * Create a subdirectory for a specific download
 */
export const createDownloadDirectory = async (downloadId) => {
  try {
    const baseDir = await ensureContentDirectory();
    const downloadDir = `${baseDir}/${downloadId}`;

    const exists = await RNFS.exists(downloadDir);
    if (!exists) {
      await RNFS.mkdir(downloadDir);
    }

    return downloadDir;
  } catch (error) {
    console.error('Failed to create download directory:', error);
    throw error;
  }
};


/**
 * Save text content (HTML / JSON / etc.) to a file
 */
export const saveContent = async (filename, content, downloadId = null) => {
  try {
    const targetDir = downloadId
      ? await createDownloadDirectory(downloadId)
      : await ensureContentDirectory();

    const filePath = `${targetDir}/${filename}`;
    await RNFS.writeFile(filePath, content, 'utf8');

    console.log('Content saved to:', filePath);
    return `file://${filePath}`;
  } catch (error) {
    console.error('Failed to save content:', error);
    throw error;
  }
};

/**
 * Download a ZIP file with progress reporting
 * Safe for very large files
 */
export const downloadFile = async (url, downloadId, onProgress) => {
  try {
    const downloadDir = await createDownloadDirectory(downloadId);
    const destPath = `${downloadDir}/download.zip`;

    // Remove existing ZIP if retrying
    if (await RNFS.exists(destPath)) {
      await RNFS.unlink(destPath);
    }

    const task = RNFS.downloadFile({
      fromUrl: url,
      toFile: destPath,
      progressDivider: 1,
      progress: (res) => {
        if (onProgress && res.contentLength > 0) {
          onProgress(
            res.bytesWritten / res.contentLength,
            res.bytesWritten,
            res.contentLength
          );
        }
      },
    });

    const result = await task.promise;

    if (result.statusCode !== 200) {
      throw new Error(`Download failed with status ${result.statusCode}`);
    }

    return `file://${destPath}`;
  } catch (error) {
    console.error('Failed to download file:', error);
    throw error;
  }
};


/**
 * Extract ZIP archive into download directory
 */
export const extractZip = async (zipFilePath, downloadId, onProgress) => {
  try {
    const downloadDir = await createDownloadDirectory(downloadId);

    // react-native-zip-archive requires paths WITHOUT file://
    const sourcePath = zipFilePath.replace('file://', '');
    const targetPath = downloadDir;

    // Ensure ZIP exists before extracting
    if (!(await RNFS.exists(sourcePath))) {
      throw new Error('ZIP file not found');
    }

    // Native streaming unzip (safe for 400MB+)
    await unzip(sourcePath, targetPath);

    // Delete zip after extraction
    await RNFS.unlink(sourcePath);

    if (onProgress) {
      onProgress(1, 1, 1);
    }

    console.log('Extraction completed:', targetPath);
    return `file://${downloadDir}`;
  } catch (error) {
    console.error('Failed to extract zip:', error);
    throw error;
  }
};


/**
 * Find HTML/HTM entry file in a download directory
 */
export const findEntryFile = async (downloadId) => {
  try {
    const downloadDir = await createDownloadDirectory(downloadId);

    // Priority order for entry files
    const priorityFiles = ['index.html', 'index.htm', 'tour.html', 'tour.htm'];

    // Recursively search for HTML files
    const htmlFiles = await findHtmlFiles(downloadDir);

    // Check priority files first
    for (const priority of priorityFiles) {
      const found = htmlFiles.find(f => f.toLowerCase().endsWith(priority));
      if (found) {
        // Return relative path from download directory
        return found.replace(downloadDir + '/', '');
      }
    }

    // Return first HTML file found
    if (htmlFiles.length > 0) {
      return htmlFiles[0].replace(downloadDir + '/', '');
    }

    return null;
  } catch (error) {
    console.error('Failed to find entry file:', error);
    return null;
  }
};

/**
 * Recursively find HTML files
 */
const findHtmlFiles = async (dirPath, results = []) => {
  const items = await RNFS.readDir(dirPath);

  for (const item of items) {
    if (item.isDirectory()) {
      await findHtmlFiles(item.path, results);
    } else if (item.name.match(/\.html?$/i)) {
      results.push(item.path);
    }
  }

  return results;
};

/**
 * Get WebView-safe file:// URL for a download entry file
 */
export const getDownloadFileUrl = async (downloadId, entryFile) => {
  // Use direct file access instead of static server
  // const root = getContentDirectory();
  // return `file://${root}/${downloadId}/${entryFile}`;

  const origin = await startServer();
  return `${origin}/${downloadId}/${entryFile}`;
};

/**
 * Check if a download exists
 */
export const downloadExists = async (downloadId) => {
  try {
    const path = `${getContentDirectory()}/${downloadId}`;
   return await RNFS.exists(path);
  } catch (error) {
    return false;
  }
};

/**
 * Delete a single download and all its files
 */
export const deleteDownload = async (downloadId) => {
  try {
    const path = `${CONTENT_ROOT}/${downloadId}`;
    if (await RNFS.exists(path)) {
      await RNFS.unlink(path);
    }
  } catch (error) {
    console.error('Failed to delete download:', error);
    throw error;
  }
};


/**
 * Remove all downloads and recreate root directory
 */
export const clearAllDownloads = async () => {
  try{
    const path = getContentDirectory();
    const exists = await RNFS.exists(path);
    if (exists) {
      await RNFS.unlink(path);
    }
    await RNFS.mkdir(path);
  } catch (error) {
    console.error('Failed to clear downloads:', error);
    throw error;
  }
};

/**
 * Calculate total size (bytes) of a download directory for get storage info
 */
export const getDownloadSize = async (downloadId) => {
  try{
    const root = `${getContentDirectory()}/${downloadId}`;
    let total = 0;
  
    const walk = async (path) => {
      const items = await RNFS.readDir(path);
      for (const item of items) {
        if (item.isDirectory()) {
          await walk(item.path);
        } else {
          total += item.size || 0;
        }
      }
    };
  
    const exists = await RNFS.exists(root);
    if (exists) {
      await walk(root);
    }
  
    return total;
  } catch (error) {
    console.error('Failed to get download size:', error);
    throw error;
  }
};


export default {
  getContentDirectory,
  getFileUrl,
  ensureContentDirectory,
  createDownloadDirectory,
  saveContent,
  downloadFile,
  extractZip,
  findEntryFile,
  getDownloadFileUrl,
  downloadExists,
  deleteDownload,
  clearAllDownloads,
  getDownloadSize,
};
