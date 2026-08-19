async function getGuildByName(guildName) {
    try {
        const response = await fetch(`https://api.hypixel.net/guild?name=${encodeURIComponent(guildName)}&key=${process.env.HYPIXEL_API_KEY}`);
        const data = await response.json();

        // verify connection to api
        if(!data.success || !data.guild)
            throw new Error(data.cause || 'Unknown Hypixel API error');

        return data.guild;
    } catch(err) {
        console.log("Error fetching guild data: ", err);
        throw err;
    }
}

async function getGuildById(guildId) {
    try {
        const response = await fetch(`https://api.hypixel.net/guild?id=${guildId}&key=${process.env.HYPIXEL_API_KEY}`);
        const data = await response.json();

        // verify connection to api
        if(!data.success || !data.guild)
            throw new Error(data.cause || 'Unknown Hypixel API error');

        return data.guild;
    } catch(err) {
        console.log("Error fetching guild data: ", err);
        throw err;
    }
}

async function getMemberInGuildByPlayerUUID(playerUUID) {
    try {
        const response = await fetch(`https://api.hypixel.net/guild?player=${encodeURIComponent(playerUUID)}&key=${process.env.HYPIXEL_API_KEY}`);
        const data = await response.json();

        // verify connection to api
        if(!data.success || !data.guild)
            throw new Error(data.cause || 'Unknown Hypixel API error');

        const memberData = data.guild.members.find(m => m.uuid === playerUUID);
        if(!memberData) return null;

        return { ...memberData, guild_id: data.guild._id, guild_name: data.guild.name };
    } catch(err) {
        console.log("Error fetching player data: ", err);
        throw err;
    }
}

async function getPlayerByName(playerName) {
    try {
        const response = await fetch(`https://api.hypixel.net/player?name=${encodeURIComponent(playerName)}&key=${process.env.HYPIXEL_API_KEY}`);
        const data = await response.json();

        // verify connection to api
        if(!data.success || !data.player)
            throw new Error(data.cause || 'Unknown Hypixel API error');

        return data.player;
    } catch(err) {
        console.log("Error fetching player data: ", err);
        throw err;
    }
}

async function fetchSkyblockProfiles(playerUUID) {
    const response = await fetch(`https://api.hypixel.net/v2/skyblock/profiles?uuid=${playerUUID}&key=${process.env.HYPIXEL_API_KEY}`);
    const data = await response.json();

    // verify connection to api
    if(!data.success || !Array.isArray(data.profiles))
        throw new Error(data.cause || 'Unknown Hypixel API error');

    return data.profiles;
}

function skyblockLevel(profile, playerUUID) {
    return (profile.members?.[playerUUID]?.leveling?.experience ?? 0) / 100;
}

async function getProfileSkyblockLevelByUUID(playerUUID, profileName) {
    try {
        const profiles = await fetchSkyblockProfiles(playerUUID);

        const targetProfile = profileName.trim().toLowerCase();
        const match = profiles.find(p => p.cute_name?.toLowerCase() === targetProfile);
        if(!match) throw new Error(`Profile "${profileName}" not found!`);

        return { level: skyblockLevel(match, playerUUID), profile: match.cute_name };
    } catch(err) {
        console.log("Error fetching player data: ", err);
        throw err;
    }
}

// bulk use only, where no profile can be asked for
async function getBestSkyblockLevelByUUID(playerUUID) {
    try {
        const profiles = await fetchSkyblockProfiles(playerUUID);
        if(profiles.length === 0) throw new Error('No Skyblock profiles found!');

        const best = profiles.reduce((a, b) => skyblockLevel(b, playerUUID) > skyblockLevel(a, playerUUID) ? b : a);

        return { level: skyblockLevel(best, playerUUID), profile: best.cute_name };
    } catch(err) {
        console.log("Error fetching player data: ", err);
        throw err;
    }
}

async function isPlayerInGuild(playerUUID, guildId) {
    try {
        const response = await fetch(`https://api.hypixel.net/guild?id=${guildId}&key=${process.env.HYPIXEL_API_KEY}`);
        const data = await response.json();

        if(!data.success || !data.guild) return false;

        return data.guild.members.some(member => member.uuid === playerUUID);
    } catch(err) {
        console.log(err);
        return false;
    }
}

module.exports = { 
    getGuildByName, 
    getGuildById, 
    getPlayerByName, 
    getMemberInGuildByPlayerUUID, 
    getProfileSkyblockLevelByUUID,
    getBestSkyblockLevelByUUID,
    isPlayerInGuild
};