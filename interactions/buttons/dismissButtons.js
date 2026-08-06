module.exports = {
    customIds: ['invite_complete_button', 'invite_cancel_button'],
    async execute(interaction) {
        await interaction.deferUpdate();
        await interaction.message.delete();
    }
}
