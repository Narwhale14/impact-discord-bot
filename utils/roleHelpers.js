function getEligibleRoleId(roleMappings, level) {
    const eligibleRoles = Object.entries(roleMappings || {})
        .filter(([_, data]) => data.discord_role_id && data.level_requirement != null && level >= data.level_requirement) // only roles user meets reqs for
        .sort((a, b) => b[1].level_requirement - a[1].level_requirement); // sorts roles in order of greatest req

    if(eligibleRoles.length === 0) return null;

    return {
        rank: eligibleRoles[0][0],
        discord_role_id: eligibleRoles[0][1].discord_role_id
    };
}

function mappedRolesHeld(memberDiscord, roleMappings) {
    return Object.values(roleMappings || {}).map(r => r.discord_role_id).filter(rid => rid && memberDiscord.roles.cache.has(rid))
}

async function removeMappedRoles(memberDiscord, roleMappings) {
    const rolesToRemove = mappedRolesHeld(memberDiscord, roleMappings)
    if(rolesToRemove.length === 0) return 0;

    await memberDiscord.roles.remove(rolesToRemove)
    return rolesToRemove.length
}

async function updateMappedRole(memberDiscord, roleMappings, targetRoleId) {
    const held = mappedRolesHeld(memberDiscord, roleMappings);
    const staleRoles = held.filter(rid => rid !== targetRoleId);
    const hasTarget = held.includes(targetRoleId);

    if(hasTarget && staleRoles.length === 0) return false;

    if(staleRoles.length > 0) await memberDiscord.roles.remove(staleRoles);
    if(!hasTarget) await memberDiscord.roles.add(targetRoleId)

    return true
}

module.exports = { getEligibleRoleId, removeMappedRoles, updateMappedRole };