/**
 * complete (green) and cancel (red) on the "Invited" tracker embed
 * both just clear the message, the colors are only a hint to staff
 */
module.exports = {
    customIds: ['invite_complete_button', 'invite_cancel_button'],
    async execute(interaction) {
        await interaction.deferUpdate();
        await interaction.message.delete();
    }
}
