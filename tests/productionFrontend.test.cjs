const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function javascriptFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return javascriptFiles(absolute);
    return entry.isFile() && entry.name.endsWith(".js") ? [absolute] : [];
  });
}

test("Web authentication is production-only and keeps access tokens in memory", () => {
  const source = read("src/services/apiService.js");
  const setStart = source.indexOf("async function setAuthToken");
  const clearStart = source.indexOf("async function clearAuthToken");
  const setSource = source.slice(setStart, clearStart);

  assert.match(
    source,
    /https:\/\/field-inspections-backend-production\.up\.railway\.app/
  );
  assert.ok(setStart >= 0 && clearStart > setStart);
  assert.match(setSource, /authToken = token \? String\(token\) : null/);
  assert.doesNotMatch(setSource, /localStorage|AsyncStorage|setItem/);
  assert.doesNotMatch(source, /expo-secure-store|SecureStore/);
  assert.match(source, /pestify\.production\.mfa-device\.v1/);
});
test("Web exposes the complete regular-admin MFA/session API", () => {
  const source = read("src/services/apiService.js");

  for (const endpoint of [
    "/auth/mfa/enrollment/start",
    "/auth/mfa/enrollment/confirm",
    "/auth/mfa/enrollment/decline",
    "/auth/mfa/verify",
    "/auth/session/refresh",
    "/auth/session/logout"
  ]) {
    assert.ok(source.includes(endpoint), endpoint);
  }

  assert.match(
    source,
    /Super admin access is available only in Pestify iOS\./
  );
  assert.match(read("src/security/adminSessionPolicy.js"), /new Set\(\["admin"\]\)/);
  assert.match(read("src/security/adminMfaUiPolicy.js"), /new Set\(\["admin"\]\)/);
});

test("administrator sessions synchronize logout and refresh across tabs", () => {
  const context = read("src/security/AdminSessionContext.js");

  assert.match(context, /new BroadcastChannel\(WEB_CHANNEL_NAME\)/);
  assert.match(context, /message\?\.type === "logout"/);
  assert.match(context, /message\?\.type !== "refreshed"/);

  const intervalStart = context.indexOf("setInterval(");
  const intervalEnd = context.indexOf(");", intervalStart);
  const intervalBody = context.slice(intervalStart, intervalEnd + 2);
  assert.doesNotMatch(intervalBody, /refreshAdminSession/);
});

test("all Web admin headers expose the manual session timer", () => {
  assert.match(read("App.js"), /<AdminSessionProvider>/);

  for (const relativePath of [
    "src/screens/Admin/AdminHomeScreen.js",
    "src/screens/Admin/AdminNotifications.js",
    "src/screens/Admin/AdminTechCalendarPreview.js",
    "src/screens/Admin/AdminTechSchedule.js",
    "src/screens/Admin/CustomerProfile.js",
    "src/screens/Admin/CustomerRequestScreen.js",
    "src/screens/Admin/CustomersScreen.js",
    "src/screens/Admin/MaterialsScreen.js",
    "src/screens/Admin/Statistics.js",
    "src/screens/Admin/TechniciansScreen.js",
    "src/screens/Technician/ReportScreen.js"
  ]) {
    assert.match(
      read(relativePath),
      /AdminHeaderSessionActions/,
      relativePath + " is missing the session timer"
    );
  }
});

test("legacy persistent access tokens are purged and Security Lab is unreachable", () => {
  const apiSource = read("src/services/apiService.js");

  assert.match(apiSource, /LEGACY_AUTH_TOKEN_KEY = "authToken"/);
  assert.match(apiSource, /AsyncStorage\.removeItem\(LEGACY_AUTH_TOKEN_KEY\)/);
  assert.match(
    apiSource,
    /removeItem\("pestify\.production\.auth-token\.v1"\)/
  );
  assert.doesNotMatch(apiSource, /AsyncStorage\.setItem/);

  const violations = javascriptFiles(path.join(root, "src"))
    .filter(file =>
      fs.readFileSync(file, "utf8").includes(
        "security-lab-security-lab.up.railway.app"
      )
    )
    .map(file => path.relative(root, file));

  assert.deepEqual(violations, []);
});

test("customer map uploads use the active in-memory administrator token", () => {
  const apiSource = read("src/services/apiService.js");
  const customersSource = read("src/screens/Admin/CustomersScreen.js");

  assert.match(apiSource, /async function uploadCustomerMap\(formData\)/);
  assert.match(apiSource, /Authorization: `Bearer \$\{authToken\}`/);
  assert.equal(
    (customersSource.match(/apiService\.uploadCustomerMap\(formData\)/g) || []).length,
    2
  );
  assert.doesNotMatch(customersSource, /AsyncStorage|getItem\("authToken"\)/);
  assert.match(
    customersSource,
    /formData\.append\("customerId", createdCustomer\.customerId\)/
  );
});

test("all technician services use the shared Web-safe image adapter", () => {
  const helper = read("src/utils/appendServiceImages.js");

  assert.match(helper, /Platform\.OS === "web"/);
  assert.match(helper, /const blob = await response\.blob\(\)/);
  assert.match(
    helper,
    /formData\.append\(\s*fieldName,\s*blob,\s*imageName/
  );
  assert.match(helper, /"image\/heic": "heic"/);

  for (const [relativePath, expectedCalls] of [
    ["src/screens/Technician/MyocideScreen.js", 2],
    ["src/screens/Technician/CertificationServiceScreen.js", 2],
    ["src/screens/Technician/DisinfectionScreen.js", 2],
    ["src/screens/Technician/InsecticideScreen.js", 2],
    ["src/screens/Technician/SpecialServicesScreen.js", 2]
  ]) {
    const source = read(relativePath);

    assert.match(source, /import \{ appendServiceImages \}/);
    assert.equal(
      (source.match(/await appendServiceImages\(formData, reportImages/g) || [])
        .length,
      expectedCalls,
      `${relativePath} must route every create/update upload through the adapter`
    );
    assert.doesNotMatch(
      source,
      /formData\.append\("images",\s*\{\s*uri/,
      `${relativePath} still contains a browser-incompatible image append`
    );
  }
});

test("Certification uses the gallery directly on Web", () => {
  const source = read(
    "src/screens/Technician/CertificationServiceScreen.js"
  );
  const chooserStart = source.indexOf("const openImageChooser");
  const chooserEnd = source.indexOf("// New useEffect", chooserStart);
  const chooser = source.slice(chooserStart, chooserEnd);

  assert.match(
    chooser,
    /Platform\.OS === "web"[\s\S]*pickImagesFromGallery\(\)[\s\S]*return/
  );
});

test("CustomerProfile requests reports only from actual visit history", () => {
  const source = read("src/screens/Admin/CustomerProfile.js");

  assert.match(source, /apiService\.getCustomerActualVisits\(custId\)/);
  assert.doesNotMatch(
    source,
    /`\/appointments\/customer\/\$\{custId\}`/
  );
  assert.match(source, /visitSummary\.visitId[\s\S]*visitSummary\.id/);
});
