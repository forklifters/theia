/*
 * Copyright (C) 2018 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { CommandRegistry, Command, MenuModelRegistry, SelectionService, MessageType } from "@theia/core/lib/common";
import { FrontendApplication, AbstractViewContribution } from '@theia/core/lib/browser';
import { WidgetManager } from '@theia/core/lib/browser/widget-manager';
import { injectable, inject } from "inversify";
import { GitDiffWidget } from './git-diff-widget';
import { open, OpenerService } from "@theia/core/lib/browser";
import { NAVIGATOR_CONTEXT_MENU } from '@theia/navigator/lib/browser/navigator-menu';
import { UriCommandHandler, FileSystemCommandHandler } from '@theia/workspace/lib/browser/workspace-commands';
import { GitQuickOpenService } from '../git-quick-open-service';
import { FileSystem } from "@theia/filesystem/lib/common";
import { DiffUris } from '@theia/editor/lib/browser/diff-uris';
import { GIT_RESOURCE_SCHEME } from '../git-resource';
import { NotificationsMessageClient } from "@theia/messages/lib/browser/notifications-message-client";
import { Git } from "../../common";

export namespace GitDiffCommands {
    export const OPEN_FILE_DIFF: Command = {
        id: 'git-diff:open-file-diff',
        label: 'Compare with ...'
    };
}

export const GIT_DIFF = "git-diff";

@injectable()
export class GitDiffContribution extends AbstractViewContribution<GitDiffWidget> {

    constructor(
        @inject(SelectionService) protected readonly selectionService: SelectionService,
        @inject(WidgetManager) protected readonly widgetManager: WidgetManager,
        @inject(FrontendApplication) protected readonly app: FrontendApplication,
        @inject(GitQuickOpenService) protected readonly quickOpenService: GitQuickOpenService,
        @inject(FileSystem) protected readonly fileSystem: FileSystem,
        @inject(OpenerService) protected openerService: OpenerService,
        @inject(NotificationsMessageClient) protected readonly notifications: NotificationsMessageClient
    ) {
        super({
            widgetId: GIT_DIFF,
            widgetName: 'Git diff',
            defaultWidgetOptions: {
                area: 'left',
                rank: 400
            }
        });
    }

    registerMenus(menus: MenuModelRegistry): void {
        menus.registerMenuAction([...NAVIGATOR_CONTEXT_MENU, '5_diff'], {
            commandId: GitDiffCommands.OPEN_FILE_DIFF.id
        });
    }

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(GitDiffCommands.OPEN_FILE_DIFF, this.newFileHandler({
            execute: async fileUri => {
                await this.quickOpenService.chooseTagsAndBranches(
                    async (fromRevision, toRevision) => {
                        const uri = fileUri.toString();
                        const fileStat = await this.fileSystem.getFileStat(uri);
                        const options: Git.Options.Diff = {
                            uri,
                            range: {
                                fromRevision
                            }
                        };
                        if (fileStat.isDirectory) {
                            this.showWidget(options);
                        } else {
                            const fromURI = fileUri.withScheme(GIT_RESOURCE_SCHEME).withQuery(fromRevision);
                            const toURI = fileUri.withScheme(GIT_RESOURCE_SCHEME).withQuery('');
                            const diffuri = DiffUris.encode(fromURI, toURI, fileUri.displayName);
                            if (diffuri) {
                                open(this.openerService, diffuri).catch(e => {
                                    this.notifications.showMessage({
                                        text: e.message,
                                        type: MessageType.Error
                                    });
                                });
                            }
                        }
                    });
            }
        }));
    }

    async showWidget(options: Git.Options.Diff) {
        const widget = await this.widget;
        await widget.setContent(options);
        this.openView({
            toggle: true,
            activate: true
        });
    }

    protected newFileHandler(handler: UriCommandHandler): FileSystemCommandHandler {
        return new FileSystemCommandHandler(this.selectionService, handler);
    }

}
