import { removeBackground } from '@imgly/background-removal-node';
import sharp from 'sharp';

async function test() {
  try {
    console.log("Creating test image...");
    const testImage = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 1 }
      }
    }).png().toBuffer();

    console.log("Running background removal...");
    const blob = new Blob([new Uint8Array(testImage)], { type: 'image/png' });
    const bgRemovedBlob = await removeBackground(blob);
    
    console.log("Background removed successfully!");
    console.log("Result size:", bgRemovedBlob.size, "bytes");
  } catch (error) {
    console.error("Test failed:", error);
  } finally {
    process.exit();
  }
}

test();
