interface ResizeEvent {
  width?: number;
  height?: number;
  format?: string;
}

interface ResizeResponse {
  statusCode: number;
  body: {
    message: string;
    dimensions: { width: number; height: number };
    format: string;
    processingTimeMs: number;
  };
}

const input: ResizeEvent = process.env.IGNITE_INPUT ? JSON.parse(process.env.IGNITE_INPUT) : {};

async function resizeImage(event: ResizeEvent): Promise<ResizeResponse> {
  const { width = 100, height = 100, format = 'jpeg' } = event;

  const startTime = Date.now();
  
  await simulateImageProcessing(width, height);
  
  const processingTime = Date.now() - startTime;

  return {
    statusCode: 200,
    body: {
      message: 'Image resized successfully',
      dimensions: { width, height },
      format,
      processingTimeMs: processingTime
    }
  };
}

function simulateImageProcessing(width: number, height: number): Promise<void> {
  return new Promise((resolve) => {
    const complexity = (width * height) / 10000;
    const delay = Math.min(100 + complexity * 10, 1000);
    setTimeout(resolve, delay);
  });
}

resizeImage(input)
  .then(result => console.log(JSON.stringify(result, null, 2)))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
