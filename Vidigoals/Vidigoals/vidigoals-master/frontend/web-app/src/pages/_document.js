import Document, { Html, Head, Main, NextScript } from 'next/document';
import { ServerStyleSheet } from 'styled-components';

export default class MyDocument extends Document {
  static async getInitialProps(ctx) {
    const sheet = new ServerStyleSheet();
    const originalRenderPage = ctx.renderPage;

    try {
      ctx.renderPage = () =>
        originalRenderPage({
          enhanceApp: (App) => (props) =>
            sheet.collectStyles(<App {...props} />),
        });

      const initialProps = await Document.getInitialProps(ctx);
      return {
        ...initialProps,
        styles: (
          <>
            {initialProps.styles}
            {sheet.getStyleElement()}
          </>
        ),
      };
    } finally {
      sheet.seal();
    }
  }

  render() {
    return (
      <Html lang="en">
        <Head>
          {/* Open Graph / WhatsApp link preview */}
          <meta property="og:title" content="VidiGoals — Live FPL Companion" />
          <meta property="og:description" content="Real-time Premier League goal alerts, FPL points tracking, player odds, and match statistics. The ultimate FPL companion app." />
          <meta property="og:type" content="website" />
          <meta property="og:url" content="https://vidigoals.com" />
          <meta property="og:site_name" content="VidiGoals" />
          <meta property="og:image" content="https://vidigoals.com/og-image.png" />
          <meta property="og:image:width" content="1200" />
          <meta property="og:image:height" content="630" />
          {/* Twitter Card */}
          <meta name="twitter:card" content="summary" />
          <meta name="twitter:title" content="VidiGoals — Live FPL Companion" />
          <meta name="twitter:description" content="Real-time Premier League goal alerts, FPL points tracking, player odds, and match statistics." />
          {/* General SEO */}
          <meta name="description" content="VidiGoals is a live FPL companion app with real-time Premier League goal alerts, FPL points tracking, player betting odds, and match statistics." />
          <meta name="theme-color" content="#1a0a2e" />
          <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
          <link rel="icon" href="/favicon.ico" sizes="any" />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
