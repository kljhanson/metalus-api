import { DisplayDialogService } from './../../../shared/services/display-dialog.service';
import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { Pipeline, PipelineStepParam } from '../../models/pipelines.model';
import { CodeEditorComponent } from '../../../code-editor/components/code-editor/code-editor.component';
import { ObjectEditorComponent } from '../../../shared/components/object-editor/object-editor.component';
import { MatDialog } from '@angular/material/dialog';
import { PackageObject } from '../../../core/package-objects/package-objects.model';
import { SharedFunctions } from '../../../shared/utils/shared-functions';
import { PropertiesEditorModalComponent } from '../../../shared/components/properties-editor/modal/properties-editor-modal.component';
import { PipelinesSelectorModalComponent } from '../pipelines-selector-modal/pipelines-selector-modal.component';

export interface SplitParameter {
  id: number;
  value: any;
  type: string;
  language?: string;
  className?: string;
  suggestions?: string[];
}

export interface StepGroupProperty {
  pipeline?: Pipeline;
  enabled: boolean;
}

@Component({
  selector: 'app-pipelines-parameter',
  templateUrl: './pipeline-parameter.component.html',
  styleUrls: ['./pipeline-parameter.component.scss']
})
export class PipelineParameterComponent {
  @Input() stepSuggestions: string[] = [];
  @Input() packageObjects: PackageObject[];
  @Input() pipelines: Pipeline[];
  @Input() stepGroup: StepGroupProperty = { enabled: false };
  @Output() parameterUpdate = new EventEmitter<PipelineStepParam>();
  parameterName: string;
  parameters: SplitParameter[];
  complexParameter = false;
  parameter: PipelineStepParam;
  private id = 0;

  constructor(
    private dialog: MatDialog,
    private chaneDetector: ChangeDetectorRef,
    private displayDialogService: DisplayDialogService
  ) {}

  @Input()
  set stepParameters(stepParameter: PipelineStepParam) {
    if (stepParameter) {
      this.parameter = stepParameter;
      this.parameterName = stepParameter.name;
      switch (stepParameter.type.toLowerCase()) {
        case 'object':
        case 'script':
          this.complexParameter = true;
          this.parameters = [
            {
              id: this.id++,
              value: stepParameter.value,
              type: stepParameter.type,
              language: stepParameter.language,
              className: stepParameter.className,
            },
          ];
          break;
        default:
          if (stepParameter.value) {
            let value;
            let type;
            this.parameters = stepParameter.value.split('||').map((e) => {
              value = e.trim();
              type = SharedFunctions.getType(value, 'text');
              if (
                value &&
                (type === 'global' ||
                  type === 'step' ||
                  type === 'secondary' ||
                  type === 'runtime')
              ) {
                value = value.substring(1);
              }
              return {
                id: this.id++,
                value,
                type,
                suggestions:
                  type === 'step' || type === 'secondary'
                    ? this.stepSuggestions.map((s) => s)
                    : [],
              };
            });
          } else {
            this.parameters = [
              {
                type: 'text',
                value: '',
                id: this.id++,
                suggestions: [],
              },
            ];
          }
      }
    }
  }

  handleChange(id: number) {
    const paramIndex = this.parameters.findIndex((p) => p.id === id);
    if (paramIndex !== -1) {
      const param = this.parameters[paramIndex];
      if (param.type === 'step' || param.type === 'secondary') {
        param.suggestions = this.stepSuggestions;
      } else {
        param.suggestions = [];
      }

      this.complexParameter =
        param.type === 'object' || param.type === 'script';
      this.parameters[paramIndex] = param;
    }
    let parameterValue = '';
    let count = 0;
    this.parameters.forEach((p) => {
      if (typeof p.value === 'object') {
        parameterValue = p.value;
      } else if (count === 0) {
        parameterValue = SharedFunctions.getLeadCharacter(p.type) + p.value;
      } else {
        parameterValue = `${parameterValue} || ${SharedFunctions.getLeadCharacter(
          p.type
        ) + p.value}`;
      }
      count += 1;
    });
    this.parameter.value = parameterValue;
    this.parameter.type =
      this.parameters.length > 1 ? 'text' : this.parameters[0].type;
    // Only used for object or script meaning there should be only 1 parameter
    this.parameter.language = this.parameters[0].language;
    this.parameter.className = this.parameters[0].className;

    this.chaneDetector.detectChanges();
    this.parameterUpdate.emit(this.parameter);
  }

  removeClause(id: number) {
    this.parameters.splice(
      this.parameters.findIndex((p) => p.id === id),
      1
    );
    this.handleChange(id);
  }

  addClause() {
    this.parameters.push({
      id: this.id++,
      value: '',
      type: 'text',
    });
  }

  disableEditorButton(param: SplitParameter) {
    if (this.stepGroup.enabled) {
      if (this.parameter.name === 'pipeline' && param.type !== 'pipeline') {
        return true;
      } else if (
        this.parameter.name === 'pipelineId' &&
        param.type !== 'text'
      ) {
        return true;
      }
      return false;
    } else {
      return param.type !== 'object' && param.type !== 'script';
    }
  }

  openEditor(id: number) {
    const inputData = this.parameters.find((p) => p.id === id);

    if (!this.stepGroup.enabled) {
      switch (inputData.type) {
        case 'script':
          const scriptDialogData = {
            code: inputData.value,
            language: inputData.language,
            allowSave: true,
          };
          const scriptDialogResponse = this.displayDialogService.openDialog(
            CodeEditorComponent,
            '75%',
            '90%',
            scriptDialogData
          );
          scriptDialogResponse.afterClosed().subscribe((result) => {
            if (result) {
              inputData.value = result.code;
              inputData.language = result.language;
              this.handleChange(id);
            }
          });
          break;
        case 'object':
          const schema = this.packageObjects.find(
            (p) => p.id === inputData.className
          );
          let pkgSchema;
          if (schema) {
            pkgSchema = JSON.parse(schema.schema);
          }
          const objectDialogData = {
            userObject: inputData.value,
            schema: pkgSchema,
            schemaName: inputData.className,
            pkgObjs: this.packageObjects,
          };
          const objectDialogResponse = this.displayDialogService.openDialog(
            ObjectEditorComponent,
            '75%',
            '90%',
            objectDialogData
          );
          objectDialogResponse.afterClosed().subscribe((result) => {
            if (result) {
              inputData.value = result.userObject;
              inputData.className = result.schemaName;
              this.handleChange(id);
            }
          });
          break;
      }
    } else if (this.stepGroup && this.parameter.name === 'pipelineMappings') {
      let mappings = this.parameter.value || {};
      if (this.stepGroup.pipeline) {
        const pipelineMappings = SharedFunctions.generatePipelineMappings(
          this.stepGroup.pipeline
        );
        mappings = Object.assign({}, pipelineMappings, mappings);
      }
      const propertiesDialogData = {
        propertiesObject: mappings,
        allowSpecialParameters: true,
        packageObjects: this.packageObjects,
      };
      const propertiesDialogResponse = this.displayDialogService.openDialog(
        PropertiesEditorModalComponent,
        '75%',
        '90%',
        propertiesDialogData
      );
      propertiesDialogResponse.afterClosed().subscribe((result) => {
        if (result) {
          inputData.value = result.value;
          this.handleChange(id);
        }
      });
    } else if (this.stepGroup.enabled) {
      if (
        this.parameter.name === 'pipelineId' ||
        (this.parameter.name === 'pipeline' && inputData.type === 'pipeline')
      ) {
        const pipelineSelectorDialogResponse = this.displayDialogService.openDialog(
          PipelinesSelectorModalComponent,
          '50%',
          '25%',
          this.pipelines
        );
        pipelineSelectorDialogResponse.afterClosed().subscribe((result) => {
          if (result) {
            inputData.value = result;
            this.stepGroup.pipeline = this.pipelines.find(
              (p) => p.id === result
            );
            this.handleChange(id);
          }
        });
      }
    }
  }
}
