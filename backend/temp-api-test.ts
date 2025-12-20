import { NestFactory } from "@nestjs/core";
import { AppModule } from "./src/modules/app.module";

async function main() {
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log"],
  });
  await app.listen(0);
  const address = app.getHttpServer().address();
  const port = typeof address === "object" && address ? (address as any).port : 0;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`Testing backend API at ${baseUrl}`);

  try {
    const createResponse = await fetch(`${baseUrl}/sessions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        meetingId: "test-meeting",
      }),
    });
    const bodyText = await createResponse.text();
    console.log(`POST /sessions status: ${createResponse.status}`);
    console.log(`POST /sessions response: ${bodyText}`);
  } catch (error) {
    console.error("Error during API test", error);
  }

  await app.close();
}

main().catch((error) => {
  console.error("Fatal error during API test", error);
  process.exit(1);
});
