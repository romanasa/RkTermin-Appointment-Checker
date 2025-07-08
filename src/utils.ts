export async function delay(time: number) {
  return new Promise(function (resolve) {
    setTimeout(resolve, time);
  });
}
// Bot token is loaded from environment variable BOT_TOKEN
export const botToken = process.env.BOT_TOKEN || '';
