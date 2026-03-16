const fs = require("fs");
const path = require("path");
const filePath = path.join(__dirname, "..", "src", "app", "page.tsx");
let c = fs.readFileSync(filePath, "utf8");

const startMarker = "                {/* Dashboard and Mixer are now at /dashboard and /mixer */}";
const startBlock = startMarker + "\n                    <div className=\"mb-6\">";
const endMarker = "          )}\n        </div>\n\n        {/* Arrow separator";

const i = c.indexOf(startBlock);
const j = c.indexOf(endMarker);

if (i >= 0 && j >= 0) {
  const replacement =
    startMarker +
    "\n            </div>\n          </div>\n        </div>\n\n        {/* Arrow separator";
  const newContent = c.substring(0, i) + replacement + c.substring(j + endMarker.length);
  fs.writeFileSync(filePath, newContent);
  console.log("OK, removed", j - i, "chars");
} else {
  console.log("Start index:", i, "End index:", j);
  if (i < 0) console.log("Start block not found");
  if (j < 0) console.log("End marker not found, trying alternate...");
  const j2 = c.indexOf("          )}");
  console.log("j2:", j2);
}
