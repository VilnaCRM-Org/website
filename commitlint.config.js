module.exports = {
    extends: ['@commitlint/config-conventional'],
    rules: {
        'check-task-number-rule': [2, 'always'],
    },
    plugins: [
        {
            rules: {
                'check-task-number-rule': (data) => {
                    const taskNumber = data.header.match(/(feat|fix|refactor)(.#(\d+)).:/gm);

                    const correctCommit = data.header.includes(taskNumber) || false

                    return [
                        correctCommit,
                        'your task number incorrect (feat|fix|refactor(#1))',
                    ];
                }
            }
        }
    ]
};
