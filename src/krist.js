/**
 * Created by Drew Lemmy, 2016
 *
 * This file is part of Krist.
 *
 * Krist is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Krist is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Krist. If not, see <http://www.gnu.org/licenses/>.
 *
 * For more project information, see <https://github.com/Lemmmy/Krist>.
 */

function Krist() {}

module.exports = Krist;

require("./websockets.js"); // hack to deal with circular deps
const utils        = require("./utils.js");
const constants    = require("./constants.js");
const schemas      = require("./schemas.js");
const chalk        = require("chalk");
const { getRedis } = require("./redis.js");

const addressRegex = /^(?:k[a-z0-9]{9}|[a-f0-9]{10})$/;
const addressListRegex = /^(?:k[a-z0-9]{9}|[a-f0-9]{10})(?:,(?:k[a-z0-9]{9}|[a-f0-9]{10}))*$/;
const nameRegex = /^[a-z0-9]{1,64}$/i;
const aRecordRegex = /^[^\s.?#].[^\s]*$/i;

Krist.nameMetaRegex = /^(?:([a-z0-9-_]{1,32})@)?([a-z0-9]{1,64})\.kst$/i;

Krist.freeNonceSubmission = false;

Krist.workOverTime = [];

Krist.init = async function() {
  console.log(chalk`{bold [Krist]} Loading...`);

  // Pre-initialize the work to 100,000
  const r = getRedis();
  if (!await r.exists("work")) {
    await Krist.setWork(Krist.getMaxWork());
  }
  console.log(chalk`{bold [Krist]} Current work: {green ${await Krist.getWork()}}`);

  // Update the work over time every minute
  setInterval(async function() {
    await r.lpush("work-over-time", await Krist.getWork());
    await r.ltrim("work-over-time", 0, 1440);
  }, 60 * 1000);
};

Krist.getWork = async function() {
  return parseInt(await getRedis().get("work"));
};

Krist.getWorkOverTime = async function() {
  return (await getRedis().lrange("work-over-time", 0, 1440))
    .map(i => parseInt(i))
    .reverse();
};

Krist.setWork = async function(work) {  
  await getRedis().set("work", work);
};

Krist.getWalletVersion = function() {
  return constants.walletVersion;
};

Krist.getMoneySupply = function() {
  return schemas.address.sum("balance");
};

Krist.getMinWork = function() {
  return constants.minWork;
};

Krist.getMaxWork = function() {
  return constants.maxWork;
};

Krist.getWorkFactor = function() {
  return constants.workFactor;
};

Krist.getSecondsPerBlock = function() {
  return constants.secondsPerBlock;
};

Krist.makeV2Address = function(key) {
  const chars = ["", "", "", "", "", "", "", "", ""];
  let prefix = "k";
  let hash = utils.sha256(utils.sha256(key));

  for (let i = 0; i <= 8; i++) {
    chars[i] = hash.substring(0, 2);
    hash = utils.sha256(utils.sha256(hash));
  }

  for (let i = 0; i <= 8;) {
    const index = parseInt(hash.substring(2 * i, 2 + (2 * i)), 16) % 9;

    if (chars[index] === "") {
      hash = utils.sha256(hash);
    } else {
      prefix += utils.hexToBase36(parseInt(chars[index], 16));
      chars[index] = "";
      i++;
    }
  }

  return prefix;
};

Krist.isValidKristAddress = function(address) {
  return addressRegex.test(address);
};

Krist.isValidKristAddressList = function(addressList) {
  return addressListRegex.test(addressList);
};

Krist.isValidName = function(name) {
  return nameRegex.test(name) && name.length > 0 && name.length < 65;
};

Krist.isValidARecord = function(ar) {
  return aRecordRegex.test(ar);
};

Krist.getMOTD = async function() {
  try {
    const r = getRedis();
    const motd = await r.get("motd");
    const date = new Date(await r.get("motd:date"));

    return {
      motd,
      motd_set: date,
      debug_mode: process.env.NODE_ENV !== "production"
    };
  } catch (error) { // Return a generic MOTD if the file was not found
    console.error(error);
    return { motd: "Welcome to Krist!" };
  }
};
